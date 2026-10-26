import type { Db } from '../db.js';
import { config } from '../config.js';
import { randomToken, sha256 } from '../lib/ids.js';
import { nowIso, nowMs, toIso } from '../lib/time.js';

export interface SessionContext {
  sessionId: string;
  userId: string;
  email: string;
  csrfToken: string;
  expiresAt: string;
  createdAt: string;
}

interface SessionRow {
  id: string;
  user_id: string;
  csrf_token: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  email: string;
}

export interface CreatedSession {
  token: string;
  csrfToken: string;
  expiresAt: string;
}

/** The raw token only ever lives in the cookie; the database stores its SHA-256 hash. */
export async function createSession(
  db: Db,
  userId: string,
  meta: { userAgent?: string | undefined; ipHash?: string | null } = {},
): Promise<CreatedSession> {
  const token = randomToken(32);
  const csrfToken = randomToken(24);
  const createdAt = nowIso();
  const expiresAt = toIso(nowMs() + config.sessionTtlMs);
  await db.run(
    `INSERT INTO sessions (id, user_id, csrf_token, created_at, last_seen_at, expires_at, user_agent, ip_hash)
     VALUES ($1, $2, $3, $4, $4, $5, $6, $7)`,
    [
      sha256(token),
      userId,
      csrfToken,
      createdAt,
      expiresAt,
      meta.userAgent?.slice(0, 200) ?? null,
      meta.ipHash ?? null,
    ],
  );
  return { token, csrfToken, expiresAt };
}

export async function findSession(db: Db, rawToken: string): Promise<SessionContext | null> {
  if (!rawToken) return null;
  const row = await db.one<SessionRow>(
    `SELECT s.id, s.user_id, s.csrf_token, s.created_at, s.expires_at, s.revoked_at, u.email
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = $1`,
    [sha256(rawToken)],
  );
  if (!row) return null;
  if (row.revoked_at) return null;
  if (Date.parse(row.expires_at) <= nowMs()) return null;
  return {
    sessionId: row.id,
    userId: row.user_id,
    email: row.email,
    csrfToken: row.csrf_token,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export async function touchSession(db: Db, sessionId: string, lastSeenAt: string): Promise<void> {
  const previous = await db.one<{ last_seen_at: string }>('SELECT last_seen_at FROM sessions WHERE id = $1', [
    sessionId,
  ]);
  if (!previous) return;
  // At most one write per minute and session.
  if (Date.parse(lastSeenAt) - Date.parse(previous.last_seen_at) < 60_000) return;
  await db.run('UPDATE sessions SET last_seen_at = $1 WHERE id = $2', [lastSeenAt, sessionId]);
}

export async function revokeSession(db: Db, rawToken: string): Promise<void> {
  if (!rawToken) return;
  await db.run('UPDATE sessions SET revoked_at = $1 WHERE id = $2 AND revoked_at IS NULL', [
    nowIso(),
    sha256(rawToken),
  ]);
}

export async function revokeAllSessions(db: Db, userId: string): Promise<void> {
  await db.run('UPDATE sessions SET revoked_at = $1 WHERE user_id = $2 AND revoked_at IS NULL', [nowIso(), userId]);
}

export async function purgeExpiredSessions(db: Db): Promise<void> {
  await db.run('DELETE FROM sessions WHERE expires_at < $1', [nowIso()]);
}
