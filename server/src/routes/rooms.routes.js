import { Router } from 'express';
import { getOne, getAll, run } from '../db.js';
import { asyncHandler, HttpError } from '../util/errors.js';
import { authRequired, audit } from '../auth.js';
import {
  createRoom, joinRoom, getRoomById, getMembership, assertMember,
  getRoomState, discoverEvidence, addConnection, deleteConnection,
  listNotes, createNote, updateNote, deleteNote, requestHint,
  submitAccusation, getSolutionIfAllowed, revealSolution, kickMember,
  getEventsAfter, getMySessions, appendEvent,
} from '../services/investigation.js';
import { askQuestion, listInterrogations, askAssistant } from '../services/interrogation.js';
import { broadcast } from '../realtime/hub.js';

export const roomsRouter = Router();
roomsRouter.use(authRequired);

const loadRoom = asyncHandler(async (req, _res, next) => {
  const room = getRoomById(req.params.id || req.params.roomId);
  if (!room) throw new HttpError(404, 'Rummet finns inte.');
  req.room = room;
  req.membership = assertMember(room.id, req.user);
  next();
});

roomsRouter.post('/', asyncHandler(async (req, res) => {
  const room = createRoom(req.user, req.body || {});
  res.status(201).json({ room: roomView(room) });
}));

// Snabbstart: skapa ett enspelarrum med bästa godkända fall för vald svårighetsgrad.
roomsRouter.post('/quickstart', asyncHandler(async (req, res) => {
  const { difficulty } = req.body || {};
  const fallback = getOne("SELECT id, difficulty FROM cases WHERE status = 'approved' ORDER BY official DESC LIMIT 1");
  const match = difficulty
    ? getOne("SELECT * FROM cases WHERE status = 'approved' AND difficulty = ? ORDER BY official DESC LIMIT 1", [difficulty])
    : fallback;
  const chosen = match || fallback;
  if (!chosen) throw new HttpError(409, 'Inga godkända fall är tillgängliga just nu.');
  const room = createRoom(req.user, {
    caseId: chosen.id, mode: 'solo', scoreSystem: 'realistic',
    guessLimit: 0, hintRules: 'on', difficulty: chosen.difficulty, presentation: 'text',
  });
  res.status(201).json({ room: roomView(room) });
}));

roomsRouter.post('/join', asyncHandler(async (req, res) => {
  const room = joinRoom(req.user, req.body?.code);
  broadcast(room.id, { type: 'room.changed' });
  res.json({ room: roomView(room) });
}));

roomsRouter.get('/mine', asyncHandler((req, res) => {
  res.json({ sessions: getMySessions(req.user.id) });
}));

roomsRouter.get('/:id/state', loadRoom, asyncHandler((req, res) => {
  res.json(getRoomState(req.room.id, req.user));
}));

roomsRouter.get('/:id/events', loadRoom, asyncHandler((req, res) => {
  const after = Number(req.query.after || 0);
  res.json({ events: getEventsAfter(req.room.id, after) });
}));

roomsRouter.post('/:id/evidence/:evidenceId/discover', loadRoom, asyncHandler((req, res) => {
  const result = discoverEvidence(req.room, req.user, req.params.evidenceId, req.body?.idempotencyKey);
  broadcast(req.room.id, { type: 'room.changed', reason: 'evidence.discovered' });
  res.json(result);
}));

roomsRouter.get('/:id/connections', loadRoom, asyncHandler((req, res) => {
  const rows = getAll('SELECT * FROM evidence_connections WHERE room_id = ?', [req.room.id]);
  res.json({ connections: rows });
}));

roomsRouter.post('/:id/connections', loadRoom, asyncHandler((req, res) => {
  const conn = addConnection(req.room, req.user, req.body || {}, req.body?.idempotencyKey);
  broadcast(req.room.id, { type: 'room.changed', reason: 'connection.created' });
  res.status(201).json({ connection: conn });
}));

roomsRouter.delete('/:id/connections/:connId', loadRoom, asyncHandler((req, res) => {
  deleteConnection(req.room, req.user, req.params.connId);
  broadcast(req.room.id, { type: 'room.changed', reason: 'connection.deleted' });
  res.json({ ok: true });
}));

roomsRouter.get('/:id/notes', loadRoom, asyncHandler((req, res) => {
  res.json({ notes: listNotes(req.room, req.user) });
}));
roomsRouter.post('/:id/notes', loadRoom, asyncHandler((req, res) => {
  const note = createNote(req.room, req.user, req.body || {});
  broadcast(req.room.id, { type: 'room.changed', reason: 'note.created' });
  res.status(201).json({ note });
}));
roomsRouter.put('/:id/notes/:noteId', loadRoom, asyncHandler((req, res) => {
  const note = updateNote(req.room, req.user, req.params.noteId, req.body || {});
  broadcast(req.room.id, { type: 'room.changed', reason: 'note.updated' });
  res.json({ note });
}));
roomsRouter.delete('/:id/notes/:noteId', loadRoom, asyncHandler((req, res) => {
  deleteNote(req.room, req.user, req.params.noteId);
  broadcast(req.room.id, { type: 'room.changed', reason: 'note.deleted' });
  res.json({ ok: true });
}));

roomsRouter.post('/:id/hints', loadRoom, asyncHandler((req, res) => {
  const result = requestHint(req.room, req.user, req.body?.level || 1);
  broadcast(req.room.id, { type: 'room.changed', reason: 'hint.requested' });
  res.json(result);
}));

roomsRouter.get('/:id/interrogations', loadRoom, asyncHandler((req, res) => {
  res.json({ interrogations: listInterrogations(req.room, req.user) });
}));

roomsRouter.post('/:id/interrogations', loadRoom, asyncHandler(async (req, res) => {
  const result = await askQuestion(req.room.id, req.user, req.body || {});
  broadcast(req.room.id, { type: 'room.changed', reason: 'interrogation' });
  res.status(201).json(result);
}));

roomsRouter.post('/:id/assistant', loadRoom, asyncHandler((req, res) => {
  res.json(askAssistant(req.room.id, req.user));
}));

roomsRouter.post('/:id/accusations', loadRoom, asyncHandler((req, res) => {
  const result = submitAccusation(req.room, req.user, req.body || {}, req.body?.idempotencyKey);
  broadcast(req.room.id, { type: 'room.changed', reason: 'accusation' });
  res.status(201).json(result);
}));

roomsRouter.get('/:id/solution', loadRoom, asyncHandler((req, res) => {
  res.json(getSolutionIfAllowed(req.room, req.user));
}));

roomsRouter.post('/:id/reveal', loadRoom, asyncHandler((req, res) => {
  const result = revealSolution(req.room, req.user);
  broadcast(req.room.id, { type: 'room.changed', reason: 'solution.revealed' });
  res.json(result);
}));

roomsRouter.post('/:id/kick', loadRoom, asyncHandler((req, res) => {
  kickMember(req.room, req.user.id, req.body?.userId);
  broadcast(req.room.id, { type: 'room.changed', reason: 'member.removed' });
  audit(req.user.id, 'room.kick', req.room.id, req.body);
  res.json({ ok: true });
}));

roomsRouter.post('/:id/close', loadRoom, asyncHandler((req, res) => {
  if (req.room.host_id !== req.user.id) throw new HttpError(403, 'Bara värden kan stänga rummet.');
  run("UPDATE investigation_rooms SET status = 'closed' WHERE id = ?", [req.room.id]);
  appendEvent(req.room, req.user.id, 'room.closed', {});
  broadcast(req.room.id, { type: 'room.changed', reason: 'room.closed' });
  res.json({ ok: true });
}));

function roomView(room) {
  return {
    id: room.id, code: room.code, mode: room.mode, status: room.status,
    caseId: room.case_id, caseVersion: room.case_version, hostId: room.host_id,
  };
}
