// Kärntjänster för utredningsrum: livscykel, behörighet, bevissäkring,
// bevisbräda, anteckningar, anklagelser och poäng. All kritisk logik är serversidig.
import { db, now, run, getOne, getAll, transaction } from '../db.js';
import { id, randomRoomCode, idempotencyKey } from '../util/ids.js';
import { HttpError } from '../util/errors.js';
import {
  getCaseRow, getPublicCase, getSecretCase, getBoardGroundTruth, getHint,
} from '../cases/index.js';
import { evaluateAccusation, scoreConnection, scoreDiscovery, scoreHint, timeBonus } from '../logic/scoring.js';
import { audit } from '../auth.js';

// ---------- Rum ----------

export function createRoom(user, input, options = {}) {
  const caseRow = getCaseRow(input.caseId);
  if (!caseRow) throw new HttpError(400, 'Fallet finns inte.');
  if (!options.allowDraft && caseRow.status !== 'approved') {
    throw new HttpError(400, 'Fallet är inte godkänt och kan inte startas.');
  }
  if (options.allowDraft && caseRow.creator_id && caseRow.creator_id !== user.id && user.role === 'user') {
    throw new HttpError(403, 'Testläge är bara tillgängligt för fallets skapare.');
  }
  const code = uniqueRoomCode();
  const roomId = id('room');
  const sessionId = id('ses');
  const ts = now();
  const settings = JSON.stringify({
    hintRules: input.hintRules ?? 'on',
    presentation: input.presentation || 'text',
    guessLimit: input.guessLimit || 0,
  });
  transaction(() => {
    run(
      `INSERT INTO investigation_rooms (id, code, host_id, case_id, case_version, mode, score_system,
        guess_limit, hint_rules, difficulty, status, settings, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
      [roomId, code, user.id, caseRow.id, caseRow.version, input.mode || 'solo',
        input.scoreSystem || 'realistic', input.guessLimit || 0,
        input.hintRules || 'on', input.difficulty || caseRow.difficulty, settings, ts],
    );
    run('INSERT INTO room_members (room_id, user_id, member_role, status, joined_at) VALUES (?, ?, ?, ?, ?)',
      [roomId, user.id, 'host', 'active', ts]);
    run('INSERT INTO investigation_sessions (id, room_id, user_id, status, started_at) VALUES (?, ?, ?, ?, ?)',
      [sessionId, roomId, user.id, 'active', ts]);
    appendEventInternal(roomId, user.id, 'room.created', { mode: input.mode || 'solo' });
  });
  audit(user.id, 'room.create', roomId, { caseId: caseRow.id, mode: input.mode });
  return getRoomById(roomId);
}

function uniqueRoomCode() {
  for (let i = 0; i < 10; i++) {
    const code = randomRoomCode();
    if (!getOne('SELECT 1 FROM investigation_rooms WHERE code = ?', [code])) return code;
  }
  throw new HttpError(500, 'Kunde inte tilldela rumskod, försök igen.');
}

export function getRoomById(roomId) {
  return getOne('SELECT * FROM investigation_rooms WHERE id = ?', [roomId]);
}

export function findRoomByCode(code) {
  return getOne('SELECT * FROM investigation_rooms WHERE code = ?', [String(code).toUpperCase().trim()]);
}

export function getMembership(roomId, userId) {
  return getOne('SELECT * FROM room_members WHERE room_id = ? AND user_id = ?', [roomId, userId]);
}

export function assertMember(roomId, user) {
  const m = getMembership(roomId, user.id);
  if (!m) throw new HttpError(403, 'Du är inte medlem i det här rummet.');
  if (m.status === 'removed') throw new HttpError(403, 'Du har tagits bort från rummet.');
  return m;
}

export function joinRoom(user, code) {
  const room = findRoomByCode(code);
  if (!room) throw new HttpError(404, 'Inget rum med den koden.');
  if (room.status === 'closed') throw new HttpError(403, 'Rummet är stängt.');
  const existing = getMembership(room.id, user.id);
  if (existing?.status === 'removed') throw new HttpError(403, 'Du har tagits bort från det här rummet.');
  if (!existing) {
    transaction(() => {
      run('INSERT INTO room_members (room_id, user_id, member_role, status, joined_at) VALUES (?, ?, ?, ?, ?)',
        [room.id, user.id, 'player', 'active', now()]);
      run('INSERT INTO investigation_sessions (id, room_id, user_id, status, started_at) VALUES (?, ?, ?, ?, ?)',
        [id('ses'), room.id, user.id, 'active', now()]);
      appendEventInternal(room.id, user.id, 'member.joined', { userId: user.id });
    });
    audit(user.id, 'room.join', room.id);
  } else {
    run("UPDATE room_members SET status = 'active' WHERE room_id = ? AND user_id = ?", [room.id, user.id]);
    appendEventInternal(room.id, user.id, 'member.reconnected', { userId: user.id });
  }
  return getRoomById(room.id);
}

export function setMemberPresence(roomId, userId, status) {
  run('UPDATE room_members SET status = ? WHERE room_id = ? AND user_id = ?', [status, roomId, userId]);
}

export function kickMember(room, actorUserId, targetUserId) {
  if (room.host_id !== actorUserId) throw new HttpError(403, 'Bara värden kan hantera deltagare.');
  if (targetUserId === actorUserId) throw new HttpError(400, 'Värden kan inte ta bort sig själv.');
  const m = getMembership(room.id, targetUserId);
  if (!m) throw new HttpError(404, 'Spelaren finns inte i rummet.');
  run("UPDATE room_members SET status = 'removed' WHERE room_id = ? AND user_id = ?", [room.id, targetUserId]);
  appendEventInternal(room.id, actorUserId, 'member.removed', { userId: targetUserId });
  audit(actorUserId, 'room.kick', room.id, { targetUserId });
}

// Värdåtergång om värden kopplar ner: äldsta kvarvarande medlemmen tar över.
export function maybeMigrateHost(roomId) {
  const room = getRoomById(roomId);
  if (!room || room.status === 'closed') return;
  const host = getOne('SELECT status FROM room_members WHERE room_id = ? AND user_id = ?', [roomId, room.host_id]);
  if (host && host.status !== 'removed') return;
  const next = getOne(
    "SELECT user_id FROM room_members WHERE room_id = ? AND status != 'removed' ORDER BY joined_at ASC LIMIT 1", [roomId]);
  if (next) {
    run('UPDATE investigation_rooms SET host_id = ? WHERE id = ?', [next.user_id, roomId]);
    run("UPDATE room_members SET member_role = 'host' WHERE room_id = ? AND user_id = ?", [roomId, next.user_id]);
    appendEventInternal(roomId, next.user_id, 'host.migrated', { userId: next.user_id });
  }
}

// ---------- Händelselogg (versionsmedveten, idempotent) ----------

function nextSeq(roomId) {
  const row = getOne('SELECT COALESCE(MAX(seq), 0) AS s FROM session_events WHERE room_id = ?', [roomId]);
  return row.s + 1;
}

function appendEventInternal(roomId, actorId, type, payload, idemKey = null) {
  const key = idemKey || idempotencyKey(`${roomId}|${type}|${JSON.stringify(payload)}|${actorId}`);
  const existing = getOne('SELECT id FROM session_events WHERE room_id = ? AND idempotency_key = ?', [roomId, key]);
  if (existing) return existing.id;
  const eventId = id('evt');
  run('INSERT INTO session_events (id, room_id, actor_id, seq, type, payload, idempotency_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [eventId, roomId, actorId, nextSeq(roomId), type, JSON.stringify(payload), key, now()]);
  return eventId;
}

export function appendEvent(room, actorId, type, payload, idemKey) {
  const eventId = appendEventInternal(room.id, actorId, type, payload, idemKey);
  return eventId;
}

export function getEventsAfter(roomId, afterSeq = 0) {
  return getAll('SELECT seq, type, payload, actor_id AS actorId, created_at AS createdAt FROM session_events WHERE room_id = ? AND seq > ? ORDER BY seq',
    [roomId, afterSeq]).map((r) => ({ ...r, payload: JSON.parse(r.payload) }));
}

// ---------- Bevissäkring ----------

export function discoverEvidence(room, user, evidenceId, idemKey) {
  const pub = getPublicCase(room.case_id);
  if (!pub.evidence.some((e) => e.id === evidenceId)) throw new HttpError(404, 'Beviset finns inte i fallet.');
  const key = idemKey || idempotencyKey(`discover|${room.id}|${evidenceId}`);
  let created = false;
  transaction(() => {
    const existing = getOne('SELECT 1 FROM discovered_evidence WHERE room_id = ? AND evidence_id = ?', [room.id, evidenceId]);
    if (!existing) {
      run('INSERT INTO discovered_evidence (room_id, evidence_id, discovered_by, created_at) VALUES (?, ?, ?, ?)',
        [room.id, evidenceId, user.id, now()]);
      appendEventInternal(room.id, user.id, 'evidence.discovered', { evidenceId, by: user.id }, key);
      if (room.score_system === 'competitive') {
        addScoreInternal(room.id, user.id, scoreDiscovery(), `Bevis säkrat: ${evidenceId}`);
      }
      created = true;
    }
  });
  return { created, evidenceId };
}

// ---------- Bevisbräda ----------

export function classifyConnection(caseId, nodeA, nodeB) {
  const links = getBoardGroundTruth(caseId);
  const key = (a, b) => [a, b].sort().join('|');
  const match = links.find((l) => key(l.a, l.b) === key(nodeA, nodeB));
  if (match) return match.type;
  const [kindA, refA] = nodeA.split(':');
  const [kindB, refB] = nodeB.split(':');
  if (refA && refA === refB && kindA !== kindB) return 'plausible';
  return 'unsupported';
}

export function addConnection(room, user, body, idemKey) {
  const pub = getPublicCase(room.case_id);
  const validNodes = new Set([
    ...pub.persons.map((p) => `person:${p.personId}`),
    ...pub.evidence.map((e) => `evidence:${e.id}`),
    ...pub.events.map((e) => `event:${e.id}`),
    ...pub.locations.map((l) => `place:${l.id}`),
  ]);
  if (!validNodes.has(body.nodeA) || !validNodes.has(body.nodeB)) {
    throw new HttpError(400, 'Ogiltiga noder i kopplingen.');
  }
  if (body.nodeA === body.nodeB) throw new HttpError(400, 'Kopplingen behöver två olika noder.');
  const classification = classifyConnection(room.case_id, body.nodeA, body.nodeB);
  const connId = id('conn');
  const key = idemKey || idempotencyKey(`conn|${room.id}|${user.id}|${body.nodeA}|${body.nodeB}`);
  transaction(() => {
    const dup = getOne('SELECT id FROM evidence_connections WHERE room_id = ? AND user_id = ? AND node_a = ? AND node_b = ?',
      [room.id, user.id, body.nodeA, body.nodeB]);
    if (dup) return;
    run('INSERT INTO evidence_connections (id, room_id, user_id, node_a, node_b, motivation, classification, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [connId, room.id, user.id, body.nodeA, body.nodeB, (body.motivation || '').slice(0, 500), classification, now()]);
    appendEventInternal(room.id, user.id, 'connection.created', { connId, classification });
    if (room.score_system === 'competitive') {
      addScoreInternal(room.id, user.id, scoreConnection(classification), `Koppling: ${classification}`);
    }
  });
  return getOne('SELECT * FROM evidence_connections WHERE id = ?', [connId]) ||
    getOne('SELECT * FROM evidence_connections WHERE room_id = ? AND user_id = ? AND node_a = ? AND node_b = ?',
      [room.id, user.id, body.nodeA, body.nodeB]);
}

export function deleteConnection(room, user, connId) {
  const conn = getOne('SELECT * FROM evidence_connections WHERE id = ? AND room_id = ?', [connId, room.id]);
  if (!conn) throw new HttpError(404, 'Kopplingen finns inte.');
  if (room.mode === 'competitive' ? conn.user_id !== user.id : false) {
    throw new HttpError(403, 'Du kan bara ta bort dina egna kopplingar i tävlingsläge.');
  }
  run('DELETE FROM evidence_connections WHERE id = ?', [connId]);
  appendEventInternal(room.id, user.id, 'connection.deleted', { connId });
}

// ---------- Anteckningar ----------

function noteVisibility(room, userId) {
  // Samarbete: delade anteckningar. Tävling: strikt privata.
  return room.mode === 'competitive' ? { user: userId } : { user: null };
}

export function listNotes(room, user) {
  if (room.mode === 'competitive') {
    return getAll('SELECT * FROM player_notes WHERE room_id = ? AND user_id = ? ORDER BY created_at DESC', [room.id, user.id]);
  }
  return getAll('SELECT * FROM player_notes WHERE room_id = ? ORDER BY created_at DESC', [room.id]);
}

export function createNote(room, user, body) {
  const noteId = id('note');
  const ts = now();
  run('INSERT INTO player_notes (id, room_id, user_id, kind, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [noteId, room.id, user.id, body.kind || 'note', (body.content || '').slice(0, 4000), ts, ts]);
  appendEventInternal(room.id, user.id, 'note.created', { noteId, shared: room.mode !== 'competitive' });
  return getOne('SELECT * FROM player_notes WHERE id = ?', [noteId]);
}

export function updateNote(room, user, noteId, body) {
  const note = getOne('SELECT * FROM player_notes WHERE id = ? AND room_id = ?', [noteId, room.id]);
  if (!note) throw new HttpError(404, 'Anteckningen finns inte.');
  if (room.mode === 'competitive' && note.user_id !== user.id) throw new HttpError(403, 'Privat anteckning.');
  run('UPDATE player_notes SET content = ?, kind = ?, updated_at = ? WHERE id = ?',
    [(body.content || '').slice(0, 4000), body.kind || note.kind, now(), noteId]);
  appendEventInternal(room.id, user.id, 'note.updated', { noteId });
  return getOne('SELECT * FROM player_notes WHERE id = ?', [noteId]);
}

export function deleteNote(room, user, noteId) {
  const note = getOne('SELECT * FROM player_notes WHERE id = ? AND room_id = ?', [noteId, room.id]);
  if (!note) throw new HttpError(404, 'Anteckningen finns inte.');
  if (room.mode === 'competitive' && note.user_id !== user.id) throw new HttpError(403, 'Privat anteckning.');
  run('DELETE FROM player_notes WHERE id = ?', [noteId]);
  appendEventInternal(room.id, user.id, 'note.deleted', { noteId });
}

// ---------- Ledtrådar ----------

export function requestHint(room, user, level) {
  if (room.hint_rules === 'off') throw new HttpError(403, 'Ledtrådar är avstängda i det här rummet.');
  const hint = getHint(room.case_id, Number(level));
  if (!hint) throw new HttpError(404, 'Ingen ledtråd på den nivån.');
  appendEventInternal(room.id, user.id, 'hint.requested', { level });
  if (room.score_system === 'competitive') addScoreInternal(room.id, user.id, scoreHint(), `Ledtråd nivå ${level}`);
  return { level, hint };
}

// ---------- Poäng ----------

function addScoreInternal(roomId, userId, points, reason) {
  run('INSERT INTO score_events (id, room_id, user_id, points, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id('score'), roomId, userId, points, reason, now()]);
}

export function getScores(room) {
  const rows = getAll(
    `SELECT s.user_id, u.display_name, SUM(s.points) AS total,
            SUM(CASE WHEN s.points > 0 THEN s.points ELSE 0 END) AS earned,
            SUM(CASE WHEN s.points < 0 THEN -s.points ELSE 0 END) AS penalties
     FROM score_events s JOIN users u ON u.id = s.user_id
     WHERE s.room_id = ? GROUP BY s.user_id ORDER BY total DESC`, [room.id]);
  return rows;
}

// ---------- Anklagelse och facit ----------

export function listMyAccusations(roomId, userId) {
  return getAll('SELECT * FROM final_accusations WHERE room_id = ? AND user_id = ? ORDER BY created_at', [roomId, userId]);
}

export function submitAccusation(room, user, body, idemKey) {
  const pub = getPublicCase(room.case_id);
  if (!pub.persons.some((p) => p.personId === body.suspectId && p.kind === 'suspect')) {
    throw new HttpError(400, 'Välj en misstänkt från fallet.');
  }
  const prior = listMyAccusations(room.id, user.id);
  if (room.guess_limit > 0 && prior.length >= room.guess_limit && !prior.some((a) => a.correct)) {
    throw new HttpError(403, `Slutgissningsgränsen (${room.guess_limit}) är nådd. Vänta på avslöjandet.`);
  }
  const secret = getSecretCase(room.case_id);
  if (!secret?.solution) throw new HttpError(500, 'Fallet saknar facit och kan inte bedömas.');
  const result = evaluateAccusation(body, secret);
  const accId = id('acc');
  const ts = now();
  transaction(() => {
    run(
      `INSERT INTO final_accusations (id, room_id, user_id, suspect_id, motive, evidence_ids, narrative,
        correct, score_detail, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [accId, room.id, user.id, body.suspectId, (body.motive || '').slice(0, 1000),
        JSON.stringify(body.evidenceIds || []), (body.narrative || '').slice(0, 4000),
        result.correct ? 1 : 0, JSON.stringify(result.detail), ts],
    );
    if (room.score_system === 'competitive') {
      addScoreInternal(room.id, user.id, result.points, 'Slutlig anklagelse');
      if (result.correct) {
        const session = getOne('SELECT * FROM investigation_sessions WHERE room_id = ? AND user_id = ?', [room.id, user.id]);
        addScoreInternal(room.id, user.id, timeBonus(session.started_at, ts, pub.playtimeMin), 'Tidsbonus');
      }
    }
    if (result.correct && room.mode !== 'competitive') {
      // Samarbete/enspelare: hela rummet löses.
      run("UPDATE investigation_sessions SET status = 'solved', finished_at = ? WHERE room_id = ? AND status = 'active'", [ts, room.id]);
      run("UPDATE investigation_rooms SET status = 'finished' WHERE id = ?", [room.id]);
    } else if (result.correct) {
      run("UPDATE investigation_sessions SET status = 'solved', finished_at = ? WHERE room_id = ? AND user_id = ?",
        [ts, room.id, user.id]);
    }
    appendEventInternal(room.id, user.id, 'accusation.submitted',
      { correct: result.correct, userId: user.id, competitive: room.mode === 'competitive' }, idemKey);
  });
  audit(user.id, 'accusation.submit', room.id, { correct: result.correct });
  // Facit visas bara när gissningen är korrekt. Fel gissning med försök kvar ger omtag;
  // i tävlingsläge väntar gemensamt avslöjande oavsett utfall.
  const showSolution = result.correct && !(room.mode === 'competitive' && !allAccused(room));
  return {
    accusationId: accId,
    correct: result.correct,
    scoreDetail: result.detail,
    points: result.points,
    guessesUsed: listMyAccusations(room.id, user.id).length,
    guessLimit: room.guess_limit,
    solution: showSolution ? buildSolutionView(room, pub, secret) : null,
  };
}

function allAccused(room) {
  const members = getAll("SELECT user_id FROM room_members WHERE room_id = ? AND status != 'removed'", [room.id]);
  const accusers = new Set(getAll('SELECT DISTINCT user_id FROM final_accusations WHERE room_id = ?', [room.id]).map((r) => r.user_id));
  return members.every((m) => accusers.has(m.user_id));
}

export function revealSolution(room, user) {
  if (room.mode === 'competitive' && room.host_id !== user.id && !allAccused(room)) {
    throw new HttpError(403, 'Avslöjande sker när alla gissat, eller när värden startar det.');
  }
  const pub = getPublicCase(room.case_id);
  const secret = getSecretCase(room.case_id);
  const accusations = getAll(
    `SELECT a.*, u.display_name FROM final_accusations a JOIN users u ON u.id = a.user_id
     WHERE a.room_id = ? ORDER BY a.created_at`, [room.id]);
  run("UPDATE investigation_rooms SET status = 'finished' WHERE id = ?", [room.id]);
  appendEventInternal(room.id, user.id, 'solution.revealed', {});
  return {
    solution: buildSolutionView(room, pub, secret),
    accusations: accusations.map((a) => ({
      id: a.id, userId: a.user_id, displayName: a.display_name, suspectId: a.suspect_id,
      motive: a.motive, evidenceIds: JSON.parse(a.evidence_ids), narrative: a.narrative,
      correct: !!a.correct, scoreDetail: JSON.parse(a.score_detail), createdAt: a.created_at,
    })),
    scores: getScores(room),
  };
}

function buildSolutionView(room, pub, secret) {
  const nameOf = (pid) => pub.persons.find((p) => p.personId === pid)?.name || pid;
  return {
    caseId: room.case_id,
    culprit: { personId: secret.solution.culpritId, name: nameOf(secret.solution.culpritId) },
    motive: secret.solution.motive,
    narrative: secret.solution.narrative,
    realTimeline: secret.solution.realTimeline,
    decisiveEvidence: secret.solution.decisiveEvidence.map((eid) => ({
      id: eid, title: pub.evidence.find((e) => e.id === eid)?.title || eid,
      meaning: secret.evidence.find((e) => e.id === eid)?.secretMeaning || '',
    })),
    alternativeExplanations: secret.solution.alternativeExplanations.map((a) => ({
      person: { personId: a.personId, name: nameOf(a.personId) },
      whySeemedGuilty: a.whySeemedGuilty,
      contradictedBy: a.contradictedBy,
      explanation: a.explanation,
    })),
  };
}

export function getSolutionIfAllowed(room, user) {
  // Facit får bara lämnas ut efter en korrekt anklagelse, gemensamt avslöjande eller färdigt rum.
  if (room.status === 'finished') {
    return revealSolution(room, user);
  }
  const mine = listMyAccusations(room.id, user.id).some((a) => a.correct);
  if (!mine) throw new HttpError(403, 'Facit blir tillgängligt först efter din slutliga anklagelse.');
  const pub = getPublicCase(room.case_id);
  const secret = getSecretCase(room.case_id);
  return { solution: buildSolutionView(room, pub, secret), accusations: [], scores: getScores(room) };
}

// --------- Samlat rumstillstånd (klientåteranslutning) ---------

export function getRoomState(roomId, user) {
  const room = getRoomById(roomId);
  if (!room) throw new HttpError(404, 'Rummet finns inte.');
  const membership = assertMember(roomId, user);
  const pub = getPublicCase(room.case_id);
  const members = getAll(
    `SELECT m.user_id AS userId, u.display_name AS displayName, m.member_role AS memberRole,
            m.status, m.joined_at AS joinedAt
     FROM room_members m JOIN users u ON u.id = m.user_id
     WHERE m.room_id = ? ORDER BY m.joined_at`, [roomId]);
  const discovered = getAll('SELECT evidence_id AS evidenceId, discovered_by AS discoveredBy, created_at AS createdAt FROM discovered_evidence WHERE room_id = ?',
    [room.id]).map((r) => r.evidenceId);
  const connections = getAll(
    'SELECT id, user_id AS userId, node_a AS nodeA, node_b AS nodeB, motivation, classification FROM evidence_connections WHERE room_id = ?',
    [room.id]);
  const notes = listNotes(room, user);
  const myAccusations = listMyAccusations(room.id, user.id).map((a) => ({
    id: a.id, suspectId: a.suspect_id, correct: !!a.correct, createdAt: a.created_at,
    scoreDetail: JSON.parse(a.score_detail),
  }));
  const sessions = getAll(
    `SELECT s.user_id AS userId, s.status, u.display_name AS displayName
     FROM investigation_sessions s JOIN users u ON u.id = s.user_id WHERE s.room_id = ?`, [roomId]);
  const canSeeSolution = room.status === 'finished' || myAccusations.some((a) => a.correct);
  return {
    room: {
      id: room.id, code: room.code, hostId: room.host_id, mode: room.mode, status: room.status,
      scoreSystem: room.score_system, guessLimit: room.guess_limit, hintRules: room.hint_rules,
      difficulty: room.difficulty, settings: JSON.parse(room.settings),
      caseId: room.case_id, caseVersion: room.case_version, createdAt: room.created_at,
    },
    membership: { role: membership.member_role, status: membership.status },
    members,
    sessions,
    case: pub,
    discoveredEvidence: discovered,
    connections,
    notes,
    myAccusations,
    scores: room.score_system === 'competitive' ? getScores(room) : [],
    canSeeSolution,
    events: getEventsAfter(room.id, 0),
  };
}

export function getMySessions(userId) {
  return getAll(
    `SELECT s.*, r.code, r.status AS room_status, r.mode, c.title, c.id AS case_id
     FROM investigation_sessions s
     JOIN investigation_rooms r ON r.id = s.room_id
     JOIN cases c ON c.id = r.case_id
     WHERE s.user_id = ? ORDER BY s.started_at DESC LIMIT 30`, [userId]);
}
