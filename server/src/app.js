// Express-app som kan användas både av den vanliga servern (main.js) och av
// Vercels serverless-funktion (api/index.js). Lyssnar aldrig själv – det gör main.js.
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { DIST_DIR } from './config.js';
import { authOptional } from './auth.js';
import { errorHandler, HttpError } from './util/errors.js';
import { seedOfficialContent } from './cases/index.js';
import { createDemoUserIfNeeded } from './seed.js';
import { authRouter } from './routes/auth.routes.js';
import { casesRouter } from './routes/cases.routes.js';
import { roomsRouter } from './routes/rooms.routes.js';
import { communityRouter } from './routes/community.routes.js';
import { builderRouter } from './routes/builder.routes.js';

// Säkerställ att databasen har schema, officiellt innehåll och demokonto.
// Idempotent – säkert att köra vid varje kallstart i serverless.
seedOfficialContent();
createDemoUserIfNeeded();

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '2mb' }));
  app.use(authOptional);

  // Åtkomstlogg utan känsliga body-fält (tyst i serverless för att hålla loggarna små).
  if (!process.env.VERCEL) {
    app.use((req, _res, next) => {
      if (req.path.startsWith('/api')) {
        // eslint-disable-next-line no-console
        console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
      }
      next();
    });
  }

  app.get('/api/health', (_req, res) => res.json({
    ok: true, service: 'mordgatan', runtime: process.env.VERCEL ? 'vercel-serverless' : 'node',
    time: new Date().toISOString(),
  }));
  app.use('/api/auth', authRouter);
  app.use('/api/cases', casesRouter);
  app.use('/api/rooms', roomsRouter);
  app.use('/api/community', communityRouter);
  app.use('/api/builder', builderRouter);
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Okänd API-slutpunkt.')));

  // Statisk produktionsklient (används i den lokala Node-servern;
  // Vercel serverar dist/ direkt och behöver inte dessa rader).
  if (fs.existsSync(DIST_DIR)) {
    app.use(express.static(DIST_DIR));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next();
      res.sendFile(path.join(DIST_DIR, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
