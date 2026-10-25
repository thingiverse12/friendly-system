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

/**
 * `vercel.json` rewrites every `/api/*` request to this function and passes the original path in a
 * `path` query parameter. Restore the real URL before Express sees it, so routing and the CSRF
 * origin check behave exactly as they do on a long-lived server.
 */
function restorePath(req) {
  const url = req.url ?? '/';
  if (!url.startsWith('/api/%5B...path%5D.js') && !url.startsWith('/api/[...path].js')) return;
  const parsed = new URL(url, 'http://localhost');
  const rest = parsed.searchParams.get('path') ?? '';
  parsed.searchParams.delete('path');
  const query = parsed.searchParams.toString();
  req.url = `/api${rest ? `/${rest}` : ''}${query ? `?${query}` : ''}`;
}

export default async function handler(req, res) {
  restorePath(req);
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
