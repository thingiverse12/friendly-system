import { createApp } from './app.js';
import { openDatabase } from './db.js';
import { config } from './config.js';
import { ensurePublicCompetitions, syncCompetitionLifecycle } from './services/competitions.js';
import { purgeExpiredSessions } from './services/sessions.js';

const db = openDatabase();
console.log(`[sparly] database: ${config.databaseFile}`);

ensurePublicCompetitions(db);
syncCompetitionLifecycle(db);

const app = createApp(db);

const server = app.listen(config.port, config.host, () => {
  console.log(`[sparly] listening on http://${config.host}:${config.port} (${config.env})`);
});

// Competition lifecycle is server-time driven; the sweep is idempotent and also runs on demand.
const timer = setInterval(() => {
  try {
    syncCompetitionLifecycle(db);
    ensurePublicCompetitions(db);
    purgeExpiredSessions(db);
  } catch (error) {
    console.error('[sparly] lifecycle sweep failed', error);
  }
}, 60_000);
timer.unref();

function shutdown(signal: string): void {
  console.log(`[sparly] ${signal} received, shutting down`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
