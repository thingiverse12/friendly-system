/**
 * Vercel entry point for the Sparly API.
 *
 * The Express app is created once per warm function instance and reused across invocations. On the
 * first request the instance connects to Supabase Postgres (transaction pooler), applies any
 * pending migration and opens the public competitions for the current week/month — exactly what
 * `server/src/index.ts` does on a long-lived server.
 */
import { createApp } from '../dist/app.js';
import { createDatabase, databaseHost, migrate } from '../dist/db.js';
import { ensurePublicCompetitions, syncCompetitionLifecycle } from '../dist/services/competitions.js';
import { purgeExpiredSessions } from '../dist/services/sessions.js';

const SWEEP_INTERVAL_MS = 60_000;

let ready = null;
let db = null;
let lastSweepAt = 0;
let stage = 'database';

async function boot() {
  stage = 'database';
  db = await createDatabase();
  stage = 'migrate';
  await migrate(db);
  stage = 'competitions';
  await ensurePublicCompetitions(db);
  await syncCompetitionLifecycle(db);
  stage = 'app';
  lastSweepAt = Date.now();
  const app = createApp(db);
  stage = 'ready';
  console.log('[sparly] serverless instance ready');
  return app;
}

/** First frames of a stack trace, without absolute paths, for cold-start diagnostics. */
function trace(error) {
  const stack = error && error.stack ? String(error.stack) : '';
  return stack
    .split('\n')
    .slice(0, 6)
    .map((line) => line.trim().replace(/\/var\/task\//g, ''))
    .join(' <- ');
}

function app() {
  if (!ready) {
    ready = boot().catch((error) => {
      // A failed cold start must not be cached forever: the next request retries.
      ready = null;
      throw error;
    });
  }
  return ready;
}

export default async function handler(req, res) {
  let express;
  try {
    express = await app();
  } catch (error) {
    console.error('[sparly] could not start', error);
    res.statusCode = 503;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(
      JSON.stringify({
        error: 'Databasen är inte tillgänglig just nu.',
        detail: String(error && error.message ? error.message : error),
        databaseHost: databaseHost() ?? undefined,
        stage,
        trace: trace(error),
      }),
    );
    return;
  }

  // Competitions are server-time driven. A long-lived server sweeps on a timer; a serverless
  // function sweeps lazily, at most once a minute per instance.
  if (db && Date.now() - lastSweepAt > SWEEP_INTERVAL_MS) {
    lastSweepAt = Date.now();
    void (async () => {
      try {
        await syncCompetitionLifecycle(db);
        await ensurePublicCompetitions(db);
        await purgeExpiredSessions(db);
      } catch (error) {
        console.error('[sparly] lifecycle sweep failed', error);
      }
    })();
  }

  express(req, res);
}
