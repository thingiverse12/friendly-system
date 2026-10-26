// Engångsbiljetter för WebSocket-autentisering. Sessionscookien är HttpOnly och
// går inte att läsa från klienten, därför byter klienten in den mot en kortlivad ticket.
import crypto from 'node:crypto';
import { run, getOne } from '../db.js';
import { HttpError } from '../util/errors.js';

run(`CREATE TABLE IF NOT EXISTS ws_tickets (
  ticket TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL
)`);

export function issueTicket(userId) {
  const ticket = crypto.randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  run('INSERT INTO ws_tickets (ticket, user_id, expires_at) VALUES (?, ?, ?)', [ticket, userId, expiresAt]);
  return ticket;
}

export function consumeTicket(ticket) {
  if (!ticket) return null;
  const row = getOne('SELECT * FROM ws_tickets WHERE ticket = ?', [ticket]);
  if (!row) return null;
  run('DELETE FROM ws_tickets WHERE ticket = ?', [ticket]);
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  return row.user_id;
}

export function requireTicket(req, res) {
  if (!req.user) throw new HttpError(401, 'Inloggning krävs.');
  res.json({ ticket: issueTicket(req.user.id), expiresInSeconds: 60 });
}
