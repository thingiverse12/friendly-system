// Autentisering och behörighetsmiddleware.
// Lösenord hashas med scrypt (inbyggd krypto), sessioner är slumpmässiga token
// som bara lagras som hash. Klienten skickar token via httpOnly-cookie eller Authorization-header.
import crypto from 'node:crypto';
import { config } from './config.js';
import { now, run, getOne, transaction } from './db.js';
import { id, tokenHash } from './util/ids.js';
import { HttpError } from './util/errors.js';

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password, salt, expectedHash) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function createUser({ username, displayName, password, role = 'user' }) {
  username = String(username || '').trim().toLowerCase();
  if (!/^[a-z0-9åäö_.-]{3,24}$/i.test(username)) {
    throw new HttpError(400, 'Användarnamn måste vara 3–24 tecken (bokstäver, siffror, _ . -).');
  }
  if (!password || password.length < 8) throw new HttpError(400, 'Lösenordet måste vara minst 8 tecken.');
  if (getOne('SELECT id FROM users WHERE username = ?', [username])) {
    throw new HttpError(409, 'Användarnamnet är redan taget.');
  }
  const userId = id('usr');
  const { hash, salt } = hashPassword(password);
  const ts = now();
  transaction(() => {
    run(
      `INSERT INTO users (id, username, display_name, password_hash, password_salt, role, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, username, displayName || username, hash, salt, role, ts],
    );
    run('INSERT INTO profiles (user_id, is_private, bio, updated_at) VALUES (?, 1, ?, ?)', [userId, ts, ts]);
  });
  audit(userId, 'user.register', userId);
  return userId;
}

export function createSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + config.sessionTtlMs).toISOString();
  run('INSERT INTO auth_tokens (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)', [
    tokenHash(token), userId, expiresAt, now(),
  ]);
  return { token, expiresAt };
}

export function resolveToken(token) {
  if (!token) return null;
  const row = getOne(
    `SELECT t.user_id, t.expires_at, u.id, u.username, u.display_name, u.role, u.settings
     FROM auth_tokens t JOIN users u ON u.id = t.user_id WHERE t.token_hash = ?`,
    [tokenHash(token)],
  );
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    run('DELETE FROM auth_tokens WHERE token_hash = ?', [tokenHash(token)]);
    return null;
  }
  return {
    id: row.id, username: row.username, displayName: row.display_name,
    role: row.role, settings: safeJson(row.settings, {}),
  };
}

function safeJson(s, fallback) { try { return JSON.parse(s); } catch { return fallback; } }

function extractToken(req) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/(?:^|;\s*)mordgatan_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function authOptional(req, _res, next) {
  req.user = resolveToken(extractToken(req));
  next();
}

export function authRequired(req, res, next) {
  req.user = resolveToken(extractToken(req));
  if (!req.user) return next(new HttpError(401, 'Du måste vara inloggad.'));
  next();
}

export function roleRequired(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(new HttpError(401, 'Du måste vara inloggad.'));
    if (!roles.includes(req.user.role)) return next(new HttpError(403, 'Åtkomst nekad: otillräcklig roll.'));
    next();
  };
}

export function setSessionCookie(res, token, expiresAt) {
  const maxAge = Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000);
  res.setHeader('Set-Cookie',
    `mordgatan_token=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`);
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'mordgatan_token=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
}

export function audit(actorId, action, target = '', metadata = {}) {
  run('INSERT INTO audit_logs (id, actor_id, action, target, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id('aud'), actorId, action, target, JSON.stringify(metadata), now()]);
}
