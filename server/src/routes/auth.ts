import { Router } from 'express';
import { z } from 'zod';
import type { Db } from '../db.js';
import { audit } from '../db.js';
import { config } from '../config.js';
import { asyncHandler, currentUserId, rateLimit, requireAuth } from '../lib/http.js';
import { clearCookie, ensureCsrfCookie, getCookie, setCookie } from '../lib/cookies.js';
import { badRequest, forbidden, unauthorized } from '../lib/errors.js';
import {
  aliasSchema,
  emailSchema,
  parseBody,
  passwordSchema,
  RATE_LIMITS,
  timezoneSchema,
} from '../lib/validation.js';
import { sha256 } from '../lib/ids.js';
import {
  aliasTaken,
  authenticate,
  confirmPassword,
  deleteAccount,
  getUserById,
  getProfile,
  profileStats,
  registerUser,
  toPublicUser,
  updateProfile,
} from '../services/accounts.js';
import {
  consumeResetToken,
  createPasswordResetToken,
  createSession,
  lookupResetToken,
  revokeAllSessions,
  revokeSession,
} from '../services/sessions.js';
import { checkPasswordPolicy, hashPassword } from '../lib/password.js';
import { nowIso } from '../lib/time.js';
import { sendPasswordResetEmail } from '../services/mailer.js';

const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  alias: aliasSchema.optional(),
  timezone: timezoneSchema.optional(),
  publicCompetitionConsent: z.boolean().optional().default(false),
  shareBadges: z.boolean().optional().default(false),
  acceptedTerms: z.literal(true, { error: 'Du måste godkänna villkoren.' }),
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Ange lösenord.').max(200),
});

const resetRequestSchema = z.object({ email: emailSchema });
const resetSchema = z.object({
  token: z.string().min(10).max(200),
  password: passwordSchema,
});
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: passwordSchema,
});
const updateProfileSchema = z
  .object({
    alias: aliasSchema.optional(),
    timezone: timezoneSchema.optional(),
    publicCompetitionConsent: z.boolean().optional(),
    shareBadges: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Inget att uppdatera.');
const deleteAccountSchema = z.object({
  password: z.string().min(1).max(200),
  confirmation: z.literal('RADERA', { error: 'Skriv RADERA för att bekräfta.' }),
});

function issueSession(
  db: Db,
  res: Parameters<typeof setCookie>[0],
  userId: string,
  req: { headers: Record<string, unknown>; ip?: string | undefined },
): string {
  const session = createSession(db, userId, {
    userAgent: req.headers['user-agent'] as string | undefined,
    ipHash: req.ip ? sha256(req.ip).slice(0, 32) : null,
  });
  setCookie(res, config.sessionCookieName, session.token, {
    httpOnly: true,
    maxAgeMs: config.sessionTtlMs,
  });
  setCookie(res, config.csrfCookieName, session.csrfToken, {
    httpOnly: false,
    maxAgeMs: config.sessionTtlMs,
  });
  return session.csrfToken;
}

export function authRoutes(db: Db): Router {
  const router = Router();

  router.get('/csrf', (req, res) => {
    const csrfToken = ensureCsrfCookie(req, res);
    res.json({ csrfToken });
  });

  router.get('/me', (req, res) => {
    const csrfToken = ensureCsrfCookie(req, res);
    const session = res.locals.session;
    if (!session) {
      res.json({ authenticated: false, csrfToken });
      return;
    }
    const user = getUserById(db, session.userId);
    const profile = getProfile(db, session.userId);
    res.json({
      authenticated: true,
      user: toPublicUser(user, profile),
      stats: profileStats(db, session.userId),
      csrfToken: session.csrfToken,
      serverTime: nowIso(),
    });
  });

  router.post(
    '/register',
    rateLimit(db, 'register', RATE_LIMITS.register),
    asyncHandler(async (req, res) => {
      const input = parseBody(registerSchema, req.body);
      const result = await registerUser(db, input);
      const csrfToken = issueSession(db, res, result.userId, req);
      res.status(201).json({ user: result.user, csrfToken });
    }),
  );

  router.post(
    '/login',
    rateLimit(db, 'login', RATE_LIMITS.login, (req) => String((req.body as { email?: string })?.email ?? '')),
    asyncHandler(async (req, res) => {
      const input = parseBody(loginSchema, req.body);
      const user = await authenticate(db, input.email, input.password);
      const csrfToken = issueSession(db, res, user.id, req);
      audit(db, 'auth.login', user.id);
      res.json({ user: toPublicUser(user, getProfile(db, user.id)), csrfToken });
    }),
  );

  router.post('/logout', (req, res) => {
    const raw = getCookie(req, config.sessionCookieName);
    if (raw) revokeSession(db, raw);
    clearCookie(res, config.sessionCookieName);
    const csrfToken = ensureCsrfCookie(req, res);
    res.json({ ok: true, csrfToken });
  });

  router.post(
    '/password/request',
    rateLimit(db, 'password-request', RATE_LIMITS.passwordRequest, (req) =>
      String((req.body as { email?: string })?.email ?? ''),
    ),
    asyncHandler(async (req, res) => {
      const { email } = parseBody(resetRequestSchema, req.body);
      const user = db.prepare('SELECT id FROM users WHERE email = ? AND deleted_at IS NULL').get(email) as
        | { id: string }
        | undefined;
      // Always the same answer: the endpoint must not reveal whether an account exists.
      if (!user) {
        res.json({ ok: true, message: 'Om adressen finns hos oss har vi skickat en återställningslänk.' });
        return;
      }
      const reset = createPasswordResetToken(db, user.id);
      audit(db, 'auth.password_reset_requested', user.id);
      const delivery = await sendPasswordResetEmail(email, reset.token, reset.expiresAt);
      res.json({
        ok: true,
        message: 'Om adressen finns hos oss har vi skickat en återställningslänk.',
        // The token is only ever returned outside production, for local development and tests.
        ...(config.exposeResetToken && !delivery.delivered
          ? { devResetToken: reset.token, expiresAt: reset.expiresAt, delivery: delivery.reason }
          : {}),
      });
    }),
  );

  router.post(
    '/password/reset',
    rateLimit(db, 'password-reset', RATE_LIMITS.passwordReset),
    asyncHandler(async (req, res) => {
      const input = parseBody(resetSchema, req.body);
      const policy = checkPasswordPolicy(input.password);
      if (!policy.ok) throw badRequest(policy.message ?? 'Ogiltigt lösenord.');
      const lookup = lookupResetToken(db, input.token);
      if (!lookup) throw badRequest('Återställningslänken är ogiltig eller har gått ut.');
      const passwordHash = await hashPassword(input.password);
      db.transaction(() => {
        consumeResetToken(db, lookup.id);
        db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
          passwordHash,
          nowIso(),
          lookup.userId,
        );
        revokeAllSessions(db, lookup.userId);
        audit(db, 'auth.password_reset', lookup.userId);
      })();
      res.json({ ok: true, message: 'Lösenordet är uppdaterat. Logga in med ditt nya lösenord.' });
    }),
  );

  router.post(
    '/password/change',
    requireAuth,
    asyncHandler(async (req, res) => {
      const userId = currentUserId(res);
      const input = parseBody(changePasswordSchema, req.body);
      await confirmPassword(db, userId, input.currentPassword);
      if (input.currentPassword === input.newPassword) {
        throw badRequest('Det nya lösenordet måste skilja sig från det gamla.');
      }
      const passwordHash = await hashPassword(input.newPassword);
      revokeAllSessions(db, userId);
      db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
        passwordHash,
        nowIso(),
        userId,
      );
      audit(db, 'auth.password_changed', userId);
      const csrfToken = issueSession(db, res, userId, req);
      res.json({ ok: true, message: 'Lösenordet är bytt.', csrfToken });
    }),
  );

  return router;
}

export function profileRoutes(db: Db): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/', (req, res) => {
    const userId = currentUserId(res);
    const user = getUserById(db, userId);
    res.json({
      user: toPublicUser(user, getProfile(db, userId)),
      stats: profileStats(db, userId),
    });
  });

  router.patch('/', (req, res) => {
    const userId = currentUserId(res);
    const input = parseBody(updateProfileSchema, req.body);
    const user = updateProfile(db, userId, input);
    res.json({ user });
  });

  router.get('/alias-available', (req, res) => {
    const raw = String(req.query.alias ?? '');
    const parsed = aliasSchema.safeParse(raw);
    if (!parsed.success) {
      res.json({ available: false, message: parsed.error.issues[0]?.message });
      return;
    }
    const taken = aliasTaken(db, parsed.data, currentUserId(res));
    res.json({ available: !taken, message: taken ? 'Aliaset är upptaget.' : 'Aliaset är ledigt.' });
  });

  router.delete('/account', asyncHandler(async (req, res) => {
    const userId = currentUserId(res);
    const input = parseBody(deleteAccountSchema, req.body);
    await confirmPassword(db, userId, input.password);
    if (input.confirmation !== 'RADERA') throw forbidden('Bekräftelsen stämmer inte.');
    const counts = db
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM savings_goals WHERE owner_id = ?) AS goals,
           (SELECT COUNT(*) FROM transactions WHERE owner_id = ?) AS transactions,
           (SELECT COUNT(*) FROM savings_movements WHERE owner_id = ?) AS movements,
           (SELECT COUNT(*) FROM user_achievements WHERE user_id = ?) AS achievements,
           (SELECT COUNT(*) FROM competition_participants WHERE user_id = ? AND withdrawn_at IS NULL) AS competitions`,
      )
      .get(userId, userId, userId, userId, userId) as {
      goals: number;
      transactions: number;
      movements: number;
      achievements: number;
      competitions: number;
    };
    deleteAccount(db, userId, {
      deletedGoals: counts.goals,
      deletedTransactions: counts.transactions,
      deletedMovements: counts.movements,
      deletedAchievements: counts.achievements,
      groupsTransferred: 0,
      groupsDeleted: 0,
      competitionsLeft: counts.competitions,
    });
    clearCookie(res, config.sessionCookieName);
    clearCookie(res, config.csrfCookieName);
    res.json({ ok: true, message: 'Ditt konto och all finansiell data har raderats.' });
  }));

  return router;
}

export function requireSessionFor(res: Parameters<typeof currentUserId>[0]): string {
  const id = res.locals.userId;
  if (!id) throw unauthorized();
  return id;
}
