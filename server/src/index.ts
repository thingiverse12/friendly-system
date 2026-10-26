import { createApp } from './app.js';
import { createDatabase, migrate } from './db.js';
import { config } from './config.js';
import { ensurePublicCompetitions, syncCompetitionLifecycle } from './services/competitions.js';
import { purgeExpiredSessions } from './services/sessions.js';

async function main(): Promise<void> {
  const db = await createDatabase();
  await migrate(db);
  console.log(`[sparly] database: ${config.databaseUrl ? 'supabase postgres' : config.pgliteDir}`);

  await ensurePublicCompetitions(db);
  await syncCompetitionLifecycle(db);

  const app = createApp(db);
  const server = app.listen(config.port, config.host, () => {
    console.log(`[sparly] listening on http://${config.host}:${config.port} (${config.env})`);
  });

  // Competition lifecycle is server-time driven; the sweep is idempotent and also runs on demand.
  const timer = setInterval(() => {
    void (async () => {
      try {
        await syncCompetitionLifecycle(db);
        await ensurePublicCompetitions(db);
        await purgeExpiredSessions(db);
      } catch (error) {
        console.error('[sparly] lifecycle sweep failed', error);
      }
    })();
  }, 60_000);
  timer.unref();

  const shutdown = (signal: string): void => {
    console.log(`[sparly] ${signal} received, shutting down`);
    server.close(() => {
      void db.close().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(0), 5000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  console.error('[sparly] failed to start', error);
  process.exit(1);
});
