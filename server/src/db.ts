import { AsyncLocalStorage } from 'node:async_hooks';
import type { Pool } from 'pg';
import { config } from './config.js';
import { ACHIEVEMENT_SEED, migrations } from './pg/migrations.js';
import { nowIso } from './lib/time.js';
import { uuid } from './lib/ids.js';

/**
 * Async Postgres data access.
 *
 * Production talks to Supabase Postgres through `pg`; development and tests use PGlite — the same
 * Postgres engine compiled to WebAssembly — so both paths execute byte-identical SQL.
 */
export interface PreparedStatement {
  run(...params: unknown[]): Promise<number>;
  get<T = Record<string, unknown>>(...params: unknown[]): Promise<T | undefined>;
  all<T = Record<string, unknown>>(...params: unknown[]): Promise<T[]>;
}

export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  one<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | undefined>;
  run(sql: string, params?: unknown[]): Promise<number>;
  exec(sql: string): Promise<void>;
  /** Statement handle with named helpers; `?` placeholders are converted to Postgres `$n`. */
  prepare(sql: string): PreparedStatement;
  tx<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/** Converts SQLite-style `?` placeholders to Postgres `$1..$n` (string literals are left alone). */
export function toPgPlaceholders(sql: string): string {
  let index = 0;
  let out = '';
  let inString = false;
  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i]!;
    if (char === "'") {
      inString = !inString;
      out += char;
      continue;
    }
    if (char === '?' && !inString) {
      index += 1;
      out += `$${index}`;
      continue;
    }
    out += char;
  }
  return out;
}

function preparedFrom(db: Db) {
  return (sql: string): PreparedStatement => {
    const compiled = toPgPlaceholders(sql);
    return {
      run: (...params) => db.run(compiled, params),
      get: <T>(...params: unknown[]) => db.one<T>(compiled, params),
      all: <T>(...params: unknown[]) => db.query<T>(compiled, params),
    };
  };
}

type PgLike = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount?: number | null }>;
};

/**
 * Nested `db.tx` calls reuse the outer transaction instead of opening a new one. Service functions
 * can therefore compose freely without deadlocking on PGlite or exhausting the Postgres pool.
 */
const transactionScope = new AsyncLocalStorage<Db>();

/**
 * Wraps a database handle so every call is routed to the active transaction (if any). Without this,
 * a query issued inside `db.tx` would hit the pool from outside the transaction and deadlock.
 */
function scopeAware(db: Db): Db {
  const resolve = (): Db => {
    const active = transactionScope.getStore();
    return active && active !== db ? active : db;
  };
  return {
    query: (sql, params) => resolve().query(sql, params),
    one: (sql, params) => resolve().one(sql, params),
    run: (sql, params) => resolve().run(sql, params),
    exec: (sql) => resolve().exec(sql),
    prepare: (sql) => resolve().prepare(sql),
    tx: (fn) => resolve().tx(fn),
    close: () => db.close(),
  };
}

function fromPg(target: PgLike, insideTransaction: boolean): Db {
  const query = async <T>(sql: string, params: unknown[] = []): Promise<T[]> => {
    const result = await target.query(sql, params);
    return result.rows as T[];
  };
  const db = {
    query,
    async one<T>(sql: string, params: unknown[] = []) {
      return (await query<T>(sql, params))[0];
    },
    async run(sql: string, params: unknown[] = []) {
      const result = await target.query(sql, params);
      return result.rowCount ?? 0;
    },
    async exec(sql) {
      await target.query(sql);
    },
    async tx<T>(fn: (tx: Db) => Promise<T>) {
      const active = transactionScope.getStore();
      if (active) return fn(active);
      if (insideTransaction) return fn(db);
      const pool = target as unknown as Pool;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const scoped = fromPg(client as unknown as PgLike, true);
        scoped.prepare = preparedFrom(scoped);
        const result = await transactionScope.run(scoped, () => fn(scoped));
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async close() {
      await (target as unknown as Pool).end?.();
    },
  } as Db;
  db.prepare = preparedFrom(db);
  return scopeAware(db);
}

export async function createPgDatabase(connectionString: string): Promise<Db> {
  const { default: pg } = await import('pg');
  // Amounts are BIGINT öre; int8/numeric must not arrive as strings.
  pg.types.setTypeParser(20, (value: string) => Number(value));
  pg.types.setTypeParser(1700, (value: string) => Number(value));
  const ssl = connectionString.includes('supabase.co') || config.databaseSsl ? { rejectUnauthorized: false } : undefined;
  const pool = new pg.Pool({ connectionString, ssl, max: config.databasePoolSize });
  const db = scopeAware(fromPg(pool as unknown as PgLike, false));
  await db.exec('SELECT 1');
  return db;
}

/** int8 and numeric must arrive as JS numbers (money is exact integer öre). */
const NUMERIC_PARSERS = {
  20: (value: string) => Number(value),
  1700: (value: string) => Number(value),
};

/** Same Postgres SQL in-process. Used by tests and by local development without a database server. */
export async function createPgliteDatabase(location = 'memory://'): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite');
  const client = new PGlite(location === 'memory://' ? { parsers: NUMERIC_PARSERS } : { dataDir: location, parsers: NUMERIC_PARSERS });
  await client.waitReady;

  const query = async <T>(sql: string, params: unknown[] = []): Promise<T[]> => {
    const result = await client.query<T>(sql, params as never[]);
    return result.rows;
  };

  const db = {
    query,
    async one<T>(sql: string, params: unknown[] = []) {
      return (await query<T>(sql, params))[0];
    },
    async run(sql: string, params: unknown[] = []) {
      const result = await client.query(sql, params as never[]);
      return result.affectedRows ?? 0;
    },
    async exec(sql: string) {
      await client.exec(sql);
    },
    async tx<T>(fn: (tx: Db) => Promise<T>) {
      const active = transactionScope.getStore();
      if (active) return fn(active);
      const result = await client.transaction(async (trx) => {
        const scoped = {
          query: async <R>(sql: string, params: unknown[] = []) =>
            (await trx.query<R>(sql, params as never[])).rows,
          one: async <R>(sql: string, params: unknown[] = []) =>
            (await trx.query<R>(sql, params as never[])).rows[0],
          run: async (sql: string, params: unknown[] = []) =>
            (await trx.query(sql, params as never[])).affectedRows ?? 0,
          exec: async (sql: string) => {
            await trx.exec(sql);
          },
          tx: async <R>(inner: (nested: Db) => Promise<R>) => inner(db as Db),
          prepare: (() => {
            throw new Error('unreachable');
          }) as Db['prepare'],
          close: async () => undefined,
        } as Db;
        scoped.prepare = preparedFrom(scoped);
        return transactionScope.run(scoped, () => fn(scoped));
      });
      return result as T;
    },
    async close() {
      await client.close();
    },
  } as Db;
  db.prepare = preparedFrom(db);
  return scopeAware(db);
}

export async function createDatabase(): Promise<Db> {
  if (config.databaseUrl) return createPgDatabase(config.databaseUrl);
  if (config.isProduction) {
    throw new Error('DATABASE_URL måste vara satt i produktion (Supabase Postgres).');
  }
  return createPgliteDatabase(config.pgliteDir);
}

export async function migrate(db: Db): Promise<void> {
  await db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL
  )`);
  const applied = new Set((await db.query<{ id: string }>('SELECT id FROM schema_migrations')).map((row) => row.id));
  for (const migration of migrations) {
    if (applied.has(migration.id)) continue;
    await db.tx(async (tx) => {
      await tx.exec(migration.sql);
      await tx.run('INSERT INTO schema_migrations (id, name, applied_at) VALUES ($1, $2, $3)', [
        migration.id,
        migration.name,
        nowIso(),
      ]);
    });
  }
  await seedAchievements(db);
}

export async function seedAchievements(db: Db): Promise<void> {
  for (const achievement of ACHIEVEMENT_SEED) {
    await db.run(
      `INSERT INTO achievements (id, code, name, description, milestone_bps, badge, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (code) DO UPDATE SET
         name = excluded.name,
         description = excluded.description,
         milestone_bps = excluded.milestone_bps,
         badge = excluded.badge,
         sort_order = excluded.sort_order`,
      [
        achievement.code,
        achievement.code,
        achievement.name,
        achievement.description,
        achievement.milestoneBps,
        achievement.badge,
        achievement.sortOrder,
      ],
    );
  }
}

/** Audit trail: pseudonymous user id only, never e-mail, alias or amounts. */
export async function audit(
  db: Db,
  event: string,
  actorUserId: string | null,
  target?: string | null,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await db.run(
    'INSERT INTO audit_events (id, actor_user_id, event, target, metadata, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
    [uuid(), actorUserId, event, target ?? null, metadata ? JSON.stringify(metadata) : null, nowIso()],
  );
}
