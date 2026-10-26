import express from 'express';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { config, DIST_DIR } from './config.js';
import { authOptional } from './auth.js';
import { errorHandler, HttpError } from './util/errors.js';
import { seedOfficialContent } from './cases/index.js';
import { createDemoUserIfNeeded } from './seed.js';
import { attachWebSocket } from './realtime/hub.js';
import { authRouter } from './routes/auth.routes.js';
import { casesRouter } from './routes/cases.routes.js';
import { roomsRouter } from './routes/rooms.routes.js';
import { communityRouter } from './routes/community.routes.js';
import { builderRouter } from './routes/builder.routes.js';

// Databasen initieras via db.js vid import. Säkerställ att officiellt innehåll finns.
seedOfficialContent();
createDemoUserIfNeeded();

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use(authOptional);

// Enkel men mätbar åtkomstlogg (utan känsliga body-fält).
app.use((req, _res, next) => {
  if (req.path.startsWith('/api')) {
    // eslint-disable-next-line no-console
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  }
  next();
});

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'mordgatan', time: new Date().toISOString() }));
app.use('/api/auth', authRouter);
app.use('/api/cases', casesRouter);
app.use('/api/rooms', roomsRouter);
app.use('/api/community', communityRouter);
app.use('/api/builder', builderRouter);
app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Okänd API-slutpunkt.')));

// Statisk produktionsklient (byggd med Vite).
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next();
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

app.use(errorHandler);

const server = http.createServer(app);
attachWebSocket(server);

server.listen(config.port, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`Mordgåtan lyssnar på http://0.0.0.0:${config.port} (${config.env})`);
});

export { app, server };
