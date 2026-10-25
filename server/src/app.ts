import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import type { Db } from './db.js';
import { config } from './config.js';
import { AppError } from './lib/errors.js';
import { csrfMiddleware, sessionMiddleware } from './lib/http.js';
import { authRoutes, profileRoutes } from './routes/auth.js';
import { defaultAuthProvider, type AuthProvider } from './services/supabase.js';
import { goalRoutes } from './routes/goals.js';
import { transactionRoutes } from './routes/transactions.js';
import { achievementRoutes, dashboardRoutes } from './routes/achievements.js';
import { competitionRoutes } from './routes/competitions.js';
import { groupRoutes } from './routes/groups.js';
import { nowIso } from './lib/time.js';

const securityHeaders = (_req: Request, res: Response, next: NextFunction): void => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "connect-src 'self'",
      "font-src 'self'",
      "base-uri 'none'",
      "form-action 'self'",
      "object-src 'none'",
      // The sandbox preview embeds the app in an iframe; no third-party scripts are allowed at all.
      'frame-ancestors *',
    ].join('; '),
  );
  if (config.isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
};

const errorHandler = (error: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  if (res.headersSent) return;
  if (error instanceof AppError) {
    res.status(error.status).json({
      error: { code: error.code, message: error.message, details: error.details ?? undefined },
    });
    return;
  }
  const message = String((error as { message?: unknown } | null)?.message ?? error);
  // SQLite constraint failures surface as explicit, non-leaking conflicts.
  if (message.includes('UNIQUE constraint failed')) {
    res.status(409).json({ error: { code: 'conflict', message: 'Posten finns redan.' } });
    return;
  }
  if (
    message.includes('locked_snapshot_immutable') ||
    message.includes('final_score_immutable') ||
    message.includes('competition_finalised') ||
    message.includes('savings_ledger_append_only')
  ) {
    res.status(409).json({
      error: { code: 'immutable', message: 'Detta är låst och kan inte ändras.' },
    });
    return;
  }
  if (message.includes('CHECK constraint failed') || message.includes('goal_owner_mismatch')) {
    res.status(422).json({ error: { code: 'validation_error', message: 'Ogiltiga värden.' } });
    return;
  }
  if ((error as { type?: string } | null)?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'bad_request', message: 'Ogiltig JSON.' } });
    return;
  }
  console.error('[sparly] unhandled error:', error);
  res.status(500).json({ error: { code: 'internal_error', message: 'Något gick fel. Försök igen.' } });
};

export function createApp(db: Db, auth: AuthProvider = defaultAuthProvider()) {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', true);
  app.use(express.json({ limit: '64kb' }));
  app.use(securityHeaders);
  app.use(sessionMiddleware(db));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: nowIso(), version: '1.0.0' });
  });

  // Every mutating API request must be same-origin and carry the double-submit CSRF token.
  app.use('/api', csrfMiddleware);

  app.use('/api/auth', authRoutes(db, auth));
  app.use('/api/profile', profileRoutes(db, auth));
  app.use('/api/dashboard', dashboardRoutes(db));
  app.use('/api/goals', goalRoutes(db));
  app.use('/api/transactions', transactionRoutes(db));
  app.use('/api/achievements', achievementRoutes(db));
  app.use('/api/competitions', competitionRoutes(db));
  app.use('/api/groups', groupRoutes(db));

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: { code: 'not_found', message: 'Okänd endpoint.' } });
  });

  const indexPath = path.join(config.webDist, 'index.html');
  if (fs.existsSync(indexPath)) {
    app.use(
      express.static(config.webDist, {
        index: false,
        maxAge: config.isProduction ? '1h' : 0,
        etag: true,
      }),
    );
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      res.sendFile(indexPath);
    });
  } else {
    app.get('/', (_req, res) => {
      res
        .status(200)
        .type('text/plain')
        .send('Sparly API is running. Build the frontend with `npm run build:web` to serve the app here.');
    });
  }

  app.use(errorHandler);

  return app;
}
