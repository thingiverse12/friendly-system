import { Router } from 'express';
import { z } from 'zod';
import type { Db } from '../db.js';
import { audit } from '../db.js';
import {
  aliasTaken,
  deletionSummaryFor,
  deleteAccount,
  getProfile,
  getUserById,
  profileStats,
  provisionUserFromSupabase,
  toPublicUser,
  updateProfile,
} from '../services/accounts.js';
import { createSession, revokeSession } from '../services/sessions.js';
import type { AuthProvider } from '../services/supabase.js';
import { clearCookie, ensureCsrfCookie, getCookie, setCookie } from '../lib/cookies.js';
import { config } from '../config.js';
import { forbidden, unauthorized } from '../lib/errors.js';
import { asyncHandler, currentUserId, ipHash, rateLimit } from '../lib/http.js';
import { aliasSchema, parseBody, RATE_LIMITS, timezoneSchema } from '../lib/validation.js';
import { nowIso } from '../lib/time.js';
import { sha256 } from '../lib/ids.js';
import type { Request, Response } from 'express';

const sessionSchema = z.object({
  accessToken: z.string().min(20, 'Inloggningstoken saknas.').max(4096),
  alias: aliasSchema.optional(),
  timezone: timezoneSchema.optional(),
  publicCompetitionConsent: z.boolean().optional(),
  shareBadges: z.boolean().optional(),
});

const profileSchema = z
  .object({
    alias: aliasSchema.optional(),
    timezone: timezoneSchema.optional(),
    publicCompetitionConsent: z.boolean().optional(),
    shareBadges: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Inget att uppdatera.');

const deleteSchema = z.object({
  confirmation: z.literal('RADERA', { message: 'Skriv RADERA för att bekräfta.' }),
  accessToken: z.string().min(20, 'Bekräfta med ditt lösenord.').max(4096),
});

/** Creates the app session and sets both cookies (session = HttpOnly, CSRF = readable). */
function issueSession(
  db: Db,
  res: Response,
  userId: string,
  req: Request,
): Promise<string> {
  return createSession(db, userId, { userAgent: req.headers['user-agent'] as string | undefined, ipHash: ipHash(req) }).then(
    (session) => {
      setCookie(res, config.sessionCookieName, session.token, {
        httpOnly: true,
        maxAgeMs: config.sessionTtlMs,
      });
      setCookie(res, config.csrfCookieName, session.csrfToken, {
        httpOnly: false,
        maxAgeMs: config.sessionTtlMs,
      });
      return session.csrfToken;
    },
  );
}

export function authRoutes(db: Db, auth: AuthProvider) {
  const router = Router();

  router.get('/csrf', (req, res) => {
    const token = ensureCsrfCookie(req, res);
    res.json({ csrfToken: token });
  });

  router.get(
    '/me',
    asyncHandler(async (req, res) => {
      const csrfToken = ensureCsrfCookie(req, res);
      const session = res.locals.session;
      if (!session) {
        res.json({ authenticated: false, user: null, stats: null, csrfToken, serverTime: nowIso() });
        return;
      }
      const user = await getUserById(db, session.userId);
      res.json({
        authenticated: true,
        user: await toPublicUser(user, await getProfile(db, session.userId)),
        stats: await profileStats(db, session.userId),
        csrfToken,
        serverTime: nowIso(),
      });
    }),
  );

  /**
   * Exchange a Supabase Auth access token for an app session. This is the single entry point for
   * every login method Supabase supports: the password never reaches this server.
   */
  router.post(
    '/session',
    rateLimit(db, 'session', RATE_LIMITS.login),
    asyncHandler(async (req, res) => {
      const input = parseBody(sessionSchema, req.body);
      const identity = await auth.verify(input.accessToken);
      const result = await provisionUserFromSupabase(db, identity, input);
      const csrfToken = await issueSession(db, res, identity.id, req);
      await audit(db, result.created ? 'auth.signup' : 'auth.login', identity.id, null, { provider: 'supabase' });
      res.status(result.created ? 201 : 200).json({ user: result.user, csrfToken, created: result.created });
    }),
  );

  router.post('/logout', (req, res) => {
    const raw = getCookie(req, config.sessionCookieName);
    if (raw) revokeSession(db, raw);
    clearCookie(res, config.sessionCookieName);
    clearCookie(res, config.csrfCookieName);
    const csrfToken = ensureCsrfCookie(req, res);
    res.json({ ok: true, csrfToken });
  });

  return router;
}

export function profileRoutes(db: Db, auth: AuthProvider) {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      const userId = currentUserId(res);
      res.json({
        user: await toPublicUser(await getUserById(db, userId), await getProfile(db, userId)),
        stats: await profileStats(db, userId),
      });
    }),
  );

  router.patch(
    '/',
    asyncHandler(async (req, res) => {
      const userId = currentUserId(res);
      const input = parseBody(profileSchema, req.body);
      res.json({ user: await updateProfile(db, userId, input) });
    }),
  );

  router.get('/alias-available', (req, res) => {
    const parsed = aliasSchema.safeParse(req.query.alias);
    if (!parsed.success) {
      res.json({ available: false, message: parsed.error.issues[0]?.message });
      return;
    }
    void aliasTaken(db, parsed.data, res.locals.userId ?? undefined).then((taken) => {
      res.json({ available: !taken, message: taken ? 'Aliaset är upptaget.' : 'Aliaset är ledigt.' });
    });
  });

  /**
   * Deletes the account. Supabase owns the password, so the client re-authenticates and sends a
   * fresh access token; the server must see that the token belongs to the session's own user.
   */
  router.delete(
    '/account',
    asyncHandler(async (req, res) => {
      const userId = currentUserId(res);
      const input = parseBody(deleteSchema, req.body);
      const identity = await auth.verify(input.accessToken);
      if (identity.id !== userId) throw forbidden('Bekräftelsen gäller ett annat konto.');

      const summary = await deleteAccount(db, userId, await deletionSummaryFor(db, userId));
      // Remove the credential record only after the financial data is gone.
      await auth.deleteUser(userId);

      clearCookie(res, config.sessionCookieName);
      clearCookie(res, config.csrfCookieName);
      res.json({
        ok: true,
        message:
          'Ditt konto och alla dina sparanden, transaktioner och tävlingsresultat är borttagna. Inloggningen är också raderad.',
        summary,
      });
    }),
  );

  return router;
}
