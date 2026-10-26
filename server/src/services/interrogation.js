// Förhörstjänst: kopplar rummets behörighet och upptäckta bevis till AI-lagret.
import { run, getOne, getAll, now } from '../db.js';
import { id, idempotencyKey } from '../util/ids.js';
import { HttpError } from '../util/errors.js';
import { getPublicCase, getSuspectSecret } from '../cases/index.js';
import { interrogate } from '../ai/provider.js';
import { assistantReply } from '../ai/local-engine.js';
import { tryConsumeBudget, budgetStatus } from '../ai/budget.js';
import { appendEvent, getRoomById } from './investigation.js';
import { aiConfigured } from '../config.js';

function getOrCreateInterrogation(roomId, userId, suspectId) {
  let row = getOne('SELECT * FROM interrogations WHERE room_id = ? AND user_id = ? AND suspect_id = ?',
    [roomId, userId, suspectId]);
  if (!row) {
    const newId = id('int');
    run('INSERT INTO interrogations (id, room_id, user_id, suspect_id, created_at) VALUES (?, ?, ?, ?, ?)',
      [newId, roomId, userId, suspectId, now()]);
    row = getOne('SELECT * FROM interrogations WHERE id = ?', [newId]);
  }
  return row;
}

export function listInterrogations(room, user) {
  const rows = room.mode === 'competitive'
    ? getAll('SELECT * FROM interrogations WHERE room_id = ? AND user_id = ? ORDER BY created_at', [room.id, user.id])
    : getAll('SELECT * FROM interrogations WHERE room_id = ? ORDER BY created_at', [room.id]);
  return rows.map((r) => ({
    id: r.id, suspectId: r.suspect_id, userId: r.user_id,
    messages: getAll('SELECT id, role, content, evidence_id AS evidenceId, created_at AS createdAt FROM interrogation_messages WHERE interrogation_id = ? ORDER BY created_at', [r.id]),
  }));
}

export async function askQuestion(roomId, user, body) {
  const room = getRoomById(roomId);
  if (!room) throw new HttpError(404, 'Rummet finns inte.');
  const pub = getPublicCase(room.case_id);
  const suspect = pub.persons.find((p) => p.personId === body.suspectId);
  if (!suspect) throw new HttpError(404, 'Personen finns inte i fallet.');

  if (body.evidenceId) {
    const discovered = getOne('SELECT 1 FROM discovered_evidence WHERE room_id = ? AND evidence_id = ?',
      [room.id, body.evidenceId]);
    if (!discovered) throw new HttpError(403, 'Du kan bara konfrontera med bevis du redan säkrat.');
  }
  const question = String(body.question || '').slice(0, 600);
  if (!question.trim() && !body.evidenceId) throw new HttpError(400, 'Skriv en fråga eller välj ett bevis.');

  const discoveredRows = getAll('SELECT evidence_id FROM discovered_evidence WHERE room_id = ?', [room.id]);
  const discoveredIds = discoveredRows.map((r) => r.evidence_id);
  const discoveredEvidence = pub.evidence.filter((e) => discoveredIds.includes(e.id));

  const secret = getSuspectSecret(room.case_id, body.suspectId);
  const interr = getOrCreateInterrogation(room.id, user.id, body.suspectId);
  const idem = body.idempotencyKey || idempotencyKey(`ask|${interr.id}|${question}|${body.evidenceId || ''}`);

  let externalAllowed = false;
  let budget = budgetStatus(user.id, room.id);
  if (body.useExternal && aiConfigured()) {
    const consume = tryConsumeBudget(user.id, room.id);
    externalAllowed = consume.allowed;
    budget = consume.status;
  }

  const result = await interrogate({
    suspectPublic: suspect,
    secretModel: secret,
    question,
    evidenceId: body.evidenceId || null,
    discoveredEvidence,
    externalAllowed,
  });

  const ts = now();
  if (question.trim()) {
    run('INSERT INTO interrogation_messages (id, interrogation_id, role, content, evidence_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id('im'), interr.id, 'player', question, body.evidenceId || null, ts]);
  }
  run('INSERT INTO interrogation_messages (id, interrogation_id, role, content, evidence_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id('im'), interr.id, 'suspect', result.answer, body.evidenceId || null, now()]);
  appendEvent(room, user.id, 'interrogation.message', { suspectId: body.suspectId, source: result.source });

  return {
    answer: result.answer,
    source: result.source,
    truthful: result.truthful,
    externalUsed: result.source === 'external_ai',
    budget,
    idempotencyKey: idem,
  };
}

export function askAssistant(roomId, user) {
  const room = getRoomById(roomId);
  if (!room) throw new HttpError(404, 'Rummet finns inte.');
  const pub = getPublicCase(room.case_id);
  const discovered = getAll('SELECT evidence_id FROM discovered_evidence WHERE room_id = ?', [room.id])
    .map((r) => r.evidence_id);
  // Assistenten kan bara se upptäckta bevis – inga hemliga fakta läcker.
  return assistantReply(pub, discovered);
}
