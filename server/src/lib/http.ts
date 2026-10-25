import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { Db } from '../db.js';
import { config as appConfig } from '../config.js';
import { getCookie } from '../lib/cookies.js';
import { forbidden, tooManyRequests, unauthorized, badRequest } from '../lib/errors.js';
import { findSession, touchSession, type SessionContext } from '../services/sessions.js';
import { consumeRateLimit, type RateLimitRule } from '../lib/validation.js';
import { nowIso } from '../lib/time.js';
import { sha256 } from '../lib/ids.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Locals {
      db: Db;
      session: SessionContext | null;
      userId: string | null;
      requestId: string;
    }
  }
}

export function param(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== 'string' || value.length === 0) throw badRequest('Ogiltig parameter.');
  return value;
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown,
): RequestHandler {
  return async (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/** Loads the server-side session for every request; never trusts client-supplied identity. */
export function sessionMiddleware(db: Db): RequestHandler {
  return async (req, res, next) => {
    const raw = getCookie(req, appConfig.sessionCookieName);
    const session = raw ? await findSession(db, raw) : null;
    res.locals.session = session;
    res.locals.userId = session?.userId ?? null;
    res.locals.db = db;
    if (session) await touchSession(db, session.sessionId, nowIso());
    next();
  };
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!res.locals.session) {
    next(unauthorized());
    return;
  }
  next();
}

export function currentUserId(res: Response): string {
  const id = res.locals.userId;
  if (!id) throw unauthorized();
  return id;
}

/** Double-submit CSRF check plus same-origin check for every state-changing request. */
export function csrfMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    next();
    return;
  }
  try {
    assertSameOrigin(req);
  } catch (error) {
    next(error);
    return;
  }
  const header = req.headers['x-csrf-token'];
  const supplied = Array.isArray(header) ? header[0] : header;
  const session = res.locals.session as SessionContext | null;
  const expected = session ? session.csrfToken : getCookie(req, appConfig.csrfCookieName);
  if (!supplied || !expected) {
    next(forbidden('CSRF-token saknas. Ladda om sidan och försök igen.'));
    return;
  }
  if (supplied !== expected) {
    next(forbidden('CSRF-token stämmer inte. Ladda om sidan och försök igen.'));
    return;
  }
  next();
}

/**
 * Same-origin enforcement for browser requests. Behind a TLS proxy the public host arrives in
 * x-forwarded-host, so both the Host header and that value are accepted; extra origins can be
 * declared through ALLOWED_ORIGINS.
 */
export function assertSameOrigin(req: Request): void {
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  if (!origin && !referer) return; // native clients still need a valid CSRF token
  let target: URL;
  try {
    target = new URL(origin ?? (referer as string));
  } catch {
    throw badRequest('Ogiltig förfrågningskälla.');
  }
  const allowed = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const forwardedHost = (req.headers['x-forwarded-host'] as string | undefined)?.split(',')[0]?.trim();
  const hosts = new Set([req.headers.host, forwardedHost].filter(Boolean) as string[]);
  if (hosts.has(target.host)) return;
  if (allowed.includes(target.origin)) return;
  throw badRequest('Förfrågan kommer från en otillåten källa.');
}

/** Throws 429 when the rule is exceeded. Key includes IP and optional discriminator. */
export function rateLimit(
  db: Db,
  scope: string,
  rule: RateLimitRule,
  keyExtractor?: (req: Request, res: Response) => string,
): RequestHandler {
  return async (req, res, next) => {
    // req.ip is resolved by Express through the trusted proxy chain (app.set('trust proxy')).
    const ip = req.ip ?? 'unknown';
    const extra = keyExtractor ? keyExtractor(req, res) : '';
    const key = `${scope}:${sha256(`${ip}|${extra}`).slice(0, 32)}`;
    const result = await consumeRateLimit(db, key, rule);
    res.setHeader('X-RateLimit-Limit', String(rule.limit));
    res.setHeader('X-RateLimit-Remaining', String(result.remaining));
    if (!result.allowed) {
      res.setHeader('Retry-After', String(result.retryAfterSeconds));
      next(tooManyRequests(`För många försök. Försök igen om ${Math.ceil(result.retryAfterSeconds / 60)} min.`));
      return;
    }
    next();
  };
}

export function ipHash(req: Request): string | null {
  const ip = req.ip;
  return ip ? sha256(`${ip}:${appConfig.env}`).slice(0, 32) : null;
}
