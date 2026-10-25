import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from './config.js';
import { ACHIEVEMENT_SEED, migrations } from './migrations.js';
import { nowIso } from './lib/time.js';
import { uuid } from './lib/ids.js';

export type Db = Database.Database;

let instance: Db | null = null;

export function openDatabase(file: string = config.databaseFile): Db {
  if (file !== ':memory:') {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }
  const db = new Database(file);
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  if (file !== ':memory:') {
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
  }
  migrate(db);
  return db;
}

export function getDb(): Db {
  if (!instance) instance = openDatabase();
  return instance;
}

export function setDb(db: Db | null): void {
  instance = db;
}

export function migrate(db: Db): void {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL
  )`);
  const applied = new Set(
    db.prepare('SELECT id FROM schema_migrations').all().map((row) => (row as { id: string }).id),
  );
  const record = db.prepare('INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)');
  for (const migration of migrations) {
    if (applied.has(migration.id)) continue;
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(migration.sql);
      record.run(migration.id, migration.name, nowIso());
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  seedAchievements(db);
}

export function seedAchievements(db: Db): void {
  const insert = db.prepare(
    `INSERT INTO achievements (id, code, name, description, milestone_bps, badge, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(code) DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       milestone_bps = excluded.milestone_bps,
       badge = excluded.badge,
       sort_order = excluded.sort_order`,
  );
  for (const a of ACHIEVEMENT_SEED) {
    insert.run(a.code, a.code, a.name, a.description, a.milestoneBps, a.badge, a.sortOrder);
  }
}

/** Runs fn inside an IMMEDIATE transaction (write lock acquired up-front). */
export function immediate<T>(db: Db, fn: () => T): T {
  return db.transaction(fn).immediate();
}

export function audit(
  db: Db,
  event: string,
  actorUserId: string | null,
  target?: string | null,
  metadata?: Record<string, unknown>,
): void {
  db.prepare(
    'INSERT INTO audit_events (id, actor_user_id, event, target, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(uuid(), actorUserId, event, target ?? null, metadata ? JSON.stringify(metadata) : null, nowIso());
}
