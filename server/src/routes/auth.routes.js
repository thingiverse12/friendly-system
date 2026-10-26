import { Router } from 'express';
import { run, getOne, getAll, now } from '../db.js';
import { asyncHandler, HttpError } from '../util/errors.js';
import {
  createUser, createSession, setSessionCookie, clearSessionCookie, authRequired,
  verifyPassword, audit,
} from '../auth.js';
import { id } from '../util/ids.js';

export const authRouter = Router();

authRouter.post('/register', asyncHandler((req, res) => {
  const { username, displayName, password } = req.body || {};
  const userId = createUser({ username, displayName, password });
  const { token, expiresAt } = createSession(userId);
  setSessionCookie(res, token, expiresAt);
  const user = getOne('SELECT id, username, display_name, role, settings FROM users WHERE id = ?', [userId]);
  res.status(201).json({ user: publicUser(user) });
}));

authRouter.post('/login', asyncHandler((req, res) => {
  const { username, password } = req.body || {};
  const user = getOne('SELECT * FROM users WHERE username = ?', [String(username || '').trim().toLowerCase()]);
  if (!user) throw new HttpError(401, 'Fel användarnamn eller lösenord.');
  if (!verifyPassword(password || '', user.password_salt, user.password_hash)) {
    audit(user.id, 'auth.login_failed', user.id);
    throw new HttpError(401, 'Fel användarnamn eller lösenord.');
  }
  const { token, expiresAt } = createSession(user.id);
  setSessionCookie(res, token, expiresAt);
  audit(user.id, 'auth.login', user.id);
  res.json({ user: publicUser(user) });
}));

authRouter.get('/ws-ticket', authRequired, asyncHandler(async (req, res) => {
  const { requireTicket } = await import('../realtime/tickets.js');
  return requireTicket(req, res);
}));

authRouter.post('/logout', authRequired, (req, res) => {
  clearSessionCookie(res);
  audit(req.user.id, 'auth.logout', req.user.id);
  res.json({ ok: true });
});

authRouter.get('/me', authRequired, (req, res) => {
  const user = getOne(
    `SELECT u.id, u.username, u.display_name, u.role, u.settings, p.is_private, p.bio
     FROM users u JOIN profiles p ON p.user_id = u.id WHERE u.id = ?`, [req.user.id]);
  res.json({ user: publicUser(user, true) });
});

authRouter.put('/me/settings', authRequired, asyncHandler((req, res) => {
  const allowed = ['language', 'narration', 'music', 'sfx', 'presentation', 'reducedMotion', 'highContrast'];
  const current = JSON.parse(getOne('SELECT settings FROM users WHERE id = ?', [req.user.id]).settings || '{}');
  for (const key of allowed) if (key in (req.body || {})) current[key] = req.body[key];
  run('UPDATE users SET settings = ? WHERE id = ?', [JSON.stringify(current), req.user.id]);
  audit(req.user.id, 'settings.update', req.user.id);
  res.json({ settings: current });
}));

authRouter.put('/me/profile', authRequired, asyncHandler((req, res) => {
  const { bio, isPrivate } = req.body || {};
  run('UPDATE profiles SET bio = ?, is_private = ?, updated_at = ? WHERE user_id = ?',
    [String(bio ?? '').slice(0, 500), isPrivate ? 1 : 0, now(), req.user.id]);
  audit(req.user.id, 'profile.update', req.user.id);
  res.json({ ok: true });
}));

// Integritet: export av alla egna uppgifter, samt begäran om radering.
authRouter.get('/me/export', authRequired, asyncHandler((req, res) => {
  const uid = req.user.id;
  const data = {
    exportedAt: now(),
    user: getOne('SELECT id, username, display_name, role, settings, created_at FROM users WHERE id = ?', [uid]),
    profile: getOne('SELECT * FROM profiles WHERE user_id = ?', [uid]),
    notes: getAll('SELECT * FROM player_notes WHERE user_id = ?', [uid]),
    accusations: getAll('SELECT id, room_id, suspect_id, correct, created_at FROM final_accusations WHERE user_id = ?', [uid]),
    ratings: getAll('SELECT * FROM community_ratings WHERE user_id = ?', [uid]),
    comments: getAll('SELECT * FROM comments WHERE user_id = ?', [uid]),
    favorites: getAll('SELECT * FROM favorites WHERE user_id = ?', [uid]),
  };
  audit(uid, 'privacy.export', uid);
  res.json(data);
}));

authRouter.post('/me/delete-request', authRequired, asyncHandler((req, res) => {
  run('INSERT INTO privacy_requests (id, user_id, kind, status, created_at) VALUES (?, ?, ?, ?, ?)',
    [id('pr'), req.user.id, 'delete', 'open', now()]);
  audit(req.user.id, 'privacy.delete_request', req.user.id);
  clearSessionCookie(res);
  res.status(202).json({ ok: true, message: 'Din begäran om radering har registrerats och behandlas enligt policyn.' });
}));

function publicUser(row, full = false) {
  if (!row) return null;
  const base = {
    id: row.id, username: row.username, displayName: row.display_name,
    role: row.role, settings: safeParse(row.settings),
  };
  if (full) {
    base.isPrivate = !!row.is_private;
    base.bio = row.bio || '';
  }
  return base;
}
function safeParse(v) { try { return JSON.parse(v); } catch { return {}; } }
