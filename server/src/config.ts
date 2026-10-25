import path from 'node:path';

const isProduction = process.env.NODE_ENV === 'production';

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  isProduction,
  port: intEnv('PORT', 3000),
  host: process.env.HOST ?? '0.0.0.0',
  /** Absolute path of the SQLite database file. */
  databaseFile: process.env.DATABASE_FILE
    ? path.resolve(process.env.DATABASE_FILE)
    : path.resolve(process.cwd(), 'data', 'sparly.db'),
  webDist: process.env.WEB_DIST
    ? path.resolve(process.env.WEB_DIST)
    : path.resolve(process.cwd(), 'web', 'dist'),
  /** Secure cookies must be on in production unless explicitly disabled for a plain-HTTP internal deploy. */
  cookieSecure: process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === '1'
    : isProduction,
  /**
   * SameSite policy for the session/CSRF cookies. `Lax` is the recommended default; `None`
   * (requires Secure cookies) is only needed when the app is embedded in a cross-site iframe,
   * such as a sandbox live preview.
   */
  cookieSameSite: (process.env.COOKIE_SAMESITE ?? 'Lax') as 'Lax' | 'Strict' | 'None',
  sessionCookieName: 'sparly_session',
  csrfCookieName: 'sparly_csrf',
  sessionTtlMs: intEnv('SESSION_TTL_HOURS', 24 * 14) * 60 * 60 * 1000,
  /**
   * Test-only clock control. Never enabled from the network.
   */
  allowClockOverride: process.env.NODE_ENV === 'test' || process.env.SPARLY_ALLOW_CLOCK_OVERRIDE === '1',
  /** Password-reset tokens are surfaced in the API response only outside production (no SMTP in this environment). */
  exposeResetToken: !isProduction,
  trustProxy: process.env.TRUST_PROXY === '1',
};
