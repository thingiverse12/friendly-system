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

async function boot() {
  db = await createDatabase();
  await migrate(db);
  await ensurePublicCompetitions(db);
  await syncCompetitionLifecycle(db);
  lastSweepAt = Date.now();
  console.log('[sparly] serverless instance ready');
  return createApp(db);
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
