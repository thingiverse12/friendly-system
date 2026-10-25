import type { Db } from '../db.js';
import { config } from '../config.js';
import { randomToken, sha256, uuid } from '../lib/ids.js';
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
  deleted_at: string | null;
}

export interface CreatedSession {
  token: string;
  csrfToken: string;
  expiresAt: string;
}

export function createSession(
  db: Db,
  userId: string,
  meta: { userAgent?: string | undefined; ipHash?: string | null } = {},
): CreatedSession {
  const token = randomToken(32);
  const csrfToken = randomToken(24);
  const createdAt = nowIso();
  const expiresAt = toIso(nowMs() + config.sessionTtlMs);
  db.prepare(
    `INSERT INTO sessions (id, user_id, csrf_token, created_at, last_seen_at, expires_at, user_agent, ip_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    sha256(token),
    userId,
    csrfToken,
    createdAt,
    createdAt,
    expiresAt,
    meta.userAgent?.slice(0, 200) ?? null,
    meta.ipHash ?? null,
  );
  return { token, csrfToken, expiresAt };
}

export function findSession(db: Db, rawToken: string): SessionContext | null {
  if (!rawToken) return null;
  const row = db
    .prepare(
      `SELECT s.id, s.user_id, s.csrf_token, s.created_at, s.expires_at, s.revoked_at,
              u.email, u.deleted_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ?`,
    )
    .get(sha256(rawToken)) as SessionRow | undefined;
  if (!row) return null;
  if (row.revoked_at) return null;
  if (row.deleted_at) return null;
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

export function touchSession(db: Db, sessionId: string, lastSeenAt: string): void {
  const previous = db.prepare('SELECT last_seen_at FROM sessions WHERE id = ?').get(sessionId) as
    | { last_seen_at: string }
    | undefined;
  if (!previous) return;
  // Only write once a minute to avoid a write per request.
  if (Date.parse(lastSeenAt) - Date.parse(previous.last_seen_at) < 60_000) return;
  db.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?').run(lastSeenAt, sessionId);
}

export function revokeSession(db: Db, rawToken: string): void {
  if (!rawToken) return;
  db.prepare('UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL').run(
    nowIso(),
    sha256(rawToken),
  );
}

export function revokeAllSessions(db: Db, userId: string): void {
  db.prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').run(nowIso(), userId);
}

export function purgeExpiredSessions(db: Db): void {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(nowIso());
}

export interface CreatedResetToken {
  token: string;
  expiresAt: string;
}

/** Password reset token: random 256-bit value, only its SHA-256 hash is persisted. */
export function createPasswordResetToken(db: Db, userId: string): CreatedResetToken {
  const token = randomToken(32);
  const createdAt = nowIso();
  const expiresAt = toIso(nowMs() + 60 * 60 * 1000);
  db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL').run(userId);
  db.prepare(
    'INSERT INTO password_reset_tokens (id, user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
  ).run(uuid(), userId, sha256(token), createdAt, expiresAt);
  return { token, expiresAt };
}

export interface ResetLookup {
  id: string;
  userId: string;
}

export function lookupResetToken(db: Db, token: string): ResetLookup | null {
  if (!token) return null;
  const row = db
    .prepare('SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = ?')
    .get(sha256(token)) as
    | { id: string; user_id: string; expires_at: string; used_at: string | null }
    | undefined;
  if (!row || row.used_at) return null;
  if (Date.parse(row.expires_at) <= nowMs()) return null;
  return { id: row.id, userId: row.user_id };
}

export function consumeResetToken(db: Db, id: string): void {
  db.prepare('UPDATE password_reset_tokens SET used_at = ? WHERE id = ?').run(nowIso(), id);
}
