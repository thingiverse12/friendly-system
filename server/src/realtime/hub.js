// WebSocket-nav: närvaro och händelsespridning per rum.
// Klienter autentiseras med samma sessionstoken. Känsligt material skickas aldrig
// via socket – klienten får en signal och hämtar sedan sitt behörighetsstyrda tillstånd via REST.
import { WebSocketServer } from 'ws';
import { getOne } from '../db.js';
import { consumeTicket } from './tickets.js';
import { getRoomById, setMemberPresence, maybeMigrateHost } from '../services/investigation.js';

const sockets = new Map(); // ws -> { userId, roomId }

export function attachWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const ticket = url.searchParams.get('ticket');
    const roomId = url.searchParams.get('room');
    const userId = consumeTicket(ticket);
    if (!userId || !roomId) {
      ws.close(4001, 'Ogiltig autentisering');
      return;
    }
    const userRow = getOne('SELECT id, display_name FROM users WHERE id = ?', [userId]);
    const user = userRow ? { id: userRow.id, displayName: userRow.display_name } : null;
    if (!user) { ws.close(4001, 'Användare saknas'); return; }
    const room = getRoomById(roomId);
    if (!room) { ws.close(4004, 'Rummet finns inte'); return; }
    sockets.set(ws, { userId: user.id, roomId, alive: true });
    setMemberPresence(roomId, user.id, 'active');
    broadcast(roomId, { type: 'presence', userId: user.id, status: 'active' });
    ws.send(JSON.stringify({ type: 'connected', roomId }));

    ws.on('pong', () => {
      const meta = sockets.get(ws);
      if (meta) meta.alive = true;
    });
    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (msg?.type === 'ping') ws.send(JSON.stringify({ type: 'pong', t: Date.now() }));
    });
    ws.on('close', () => {
      const meta = sockets.get(ws);
      sockets.delete(ws);
      if (!meta) return;
      const stillConnected = [...sockets.values()].some((s) => s.userId === meta.userId && s.roomId === meta.roomId);
      if (stillConnected) return;
      setMemberPresence(meta.roomId, meta.userId, 'offline');
      broadcast(meta.roomId, { type: 'presence', userId: meta.userId, status: 'offline' });
      maybeMigrateHost(meta.roomId);
    });
  });

  const heartbeat = setInterval(() => {
    for (const [ws, meta] of sockets) {
      if (!meta.alive) { ws.terminate(); continue; }
      meta.alive = false;
      try { ws.ping(); } catch { /* stängs vid nästa kontroll */ }
    }
  }, 30000);
  wss.on('close', () => clearInterval(heartbeat));
  return wss;
}

export function broadcast(roomId, message) {
  const payload = JSON.stringify({ ...message, at: new Date().toISOString() });
  for (const [ws, meta] of sockets) {
    if (meta.roomId === roomId && ws.readyState === ws.OPEN) ws.send(payload);
  }
}

export function roomConnectionCount(roomId) {
  return [...sockets.values()].filter((s) => s.roomId === roomId).length;
}
