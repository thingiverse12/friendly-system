import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 8799;
const BASE = `http://127.0.0.1:${PORT}/api`;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mordgatan-test-'));
let server;
const jars = new Map();

async function call(as, method, p, body) {
  const res = await fetch(BASE + p, {
    method,
    headers: { 'content-type': 'application/json', ...(jars.get(as) ? { cookie: jars.get(as) } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const sc = res.headers.get('set-cookie');
  if (sc) jars.set(as, sc.split(';')[0]);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

before(async () => {
  server = spawn(process.execPath, ['--experimental-sqlite', 'server/src/main.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(PORT), DATA_DIR: TMP, NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/api/health`);
      if (r.ok) break;
    } catch { /* väntar in server */ }
    await new Promise((r) => setTimeout(r, 200));
  }
});

after(async () => {
  server?.kill('SIGTERM');
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('autentisering: registrering, session och fel lösenord', async () => {
  const username = `integrat${Date.now().toString(36)}`;
  const reg = await call('u', 'POST', '/auth/register', { username, displayName: 'Test', password: 'test12345' });
  assert.equal(reg.status, 201);
  const me = await call('u', 'GET', '/auth/me');
  assert.equal(me.data.user.username, username);

  const bad = await fetch(BASE + '/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password: 'fel-losen' }),
  });
  assert.equal(bad.status, 401);
});

test('skyddade slutpunkter kräver inloggning', async () => {
  const r = await fetch(BASE + '/rooms/mine');
  assert.equal(r.status, 401);
});

test('hemligt facit läcker aldrig via offentligt fall', async () => {
  const catalog = await call('u', 'GET', '/cases');
  const c = catalog.data.cases.find((x) => x.slug === 'doden-i-skargarden');
  const detail = await call('u', 'GET', `/cases/${c.id}`);
  const raw = JSON.stringify(detail.data);
  for (const forbidden of ['isCulprit', 'secretMeaning', 'secretNote', 'decisiveEvidence', 'evidenceReactions', 'hemlig']) {
    assert.ok(!raw.includes(forbidden), `läckage: ${forbidden}`);
  }
});

test('hela spelcykeln fungerar från start till lösning', async () => {
  const catalog = await call('u', 'GET', '/cases');
  const caseId = catalog.data.cases.find((x) => x.slug === 'doden-i-skargarden').id;
  const room = await call('u', 'POST', '/rooms', { caseId, mode: 'solo', scoreSystem: 'competitive', guessLimit: 0, hintRules: 'on', difficulty: 'normal' });
  assert.equal(room.status, 201);
  const rid = room.data.room.id;

  // Idempotens: dubblerad bevissäkring skapar inte dubbletter
  const d1 = await call('u', 'POST', `/rooms/${rid}/evidence/ev_mobil/discover`, {});
  const d2 = await call('u', 'POST', `/rooms/${rid}/evidence/ev_mobil/discover`, {});
  assert.equal(d1.data.created, true);
  assert.equal(d2.data.created, false);

  // Förhör med både fri fråga och konfrontation
  const q = await call('u', 'POST', `/rooms/${rid}/interrogations`, { suspectId: 'erik', question: 'Var befann du dig?' });
  assert.equal(q.status, 201);
  assert.ok(q.data.answer.length > 10);
  const confr = await call('u', 'POST', `/rooms/${rid}/interrogations`, { suspectId: 'erik', evidenceId: 'ev_mobil' });
  assert.equal(confr.status, 201);

  // Brädkoppling blir klassad serversidigt
  const conn = await call('u', 'POST', `/rooms/${rid}/connections`, { nodeA: 'person:erik', nodeB: 'evidence:ev_mobil', motivation: 'alibi' });
  assert.equal(conn.data.connection.classification, 'supported');

  // Fel gissning → inget facit
  const wrong = await call('u', 'POST', `/rooms/${rid}/accusations`, { suspectId: 'mikael', motive: 'pengar', evidenceIds: [], narrative: '' });
  assert.equal(wrong.data.correct, false);
  assert.equal(wrong.data.solution, null);

  // Facit går fortfarande inte att läsa direkt
  const blocked = await call('u', 'GET', `/rooms/${rid}/solution`);
  assert.equal(blocked.status, 403);

  // Rätt gissning → facit
  const right = await call('u', 'POST', `/rooms/${rid}/accusations`, {
    suspectId: 'erik', motive: 'Ekonomiskt motiv – markaffären', evidenceIds: ['ev_mobil', 'ev_markkop', 'ev_sms'], narrative: 'x',
  });
  assert.equal(right.data.correct, true);
  assert.equal(right.data.solution.culprit.personId, 'erik');
  assert.ok(right.data.solution.alternativeExplanations.length >= 1);

  // Poängen är helt serversidigt beräknade
  const state = await call('u', 'GET', `/rooms/${rid}/state`);
  assert.ok(Array.isArray(state.data.scores));
});

test('RBAC: vanlig användare når inte moderationsverktyg', async () => {
  const r = await call('u', 'GET', '/community/moderation/reports');
  assert.equal(r.status, 403);
});

test('utkast är privata för andra användare', async () => {
  const created = await call('u', 'POST', '/builder/cases', {
    title: 'Hemligt utkast', intro: 'En tillräckligt lång introduktionstext.', caseType: 'murder',
    environment: 'hotel', difficulty: 'normal',
  });
  const other = `konkurrent${Date.now().toString(36)}`;
  await call('v', 'POST', '/auth/register', { username: other, displayName: 'V', password: 'test12345' });
  const r = await call('v', 'GET', `/builder/cases/${created.data.caseId}`);
  assert.equal(r.status, 403);
});

test('WebSocket kräver giltig engångsbiljett', async () => {
  const ticket = (await call('u', 'GET', '/auth/ws-ticket')).data.ticket;
  assert.ok(ticket.length > 20);

  const connected = await new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws?room=fake-room&ticket=${encodeURIComponent(ticket)}`);
    ws.on('message', (raw) => {
      const m = JSON.parse(raw.toString());
      ws.close();
      resolve(m.type === 'connected' || m.type === undefined ? false : m.type);
    });
    ws.on('close', (code) => resolve(code === 4004 ? 'rejected-room' : 'closed'));
    ws.on('error', () => resolve('error'));
    setTimeout(() => resolve('timeout'), 4000);
  });
  // Rummet finns inte → anslutning nekas med 4004, men biljetten var giltig.
  assert.equal(connected, 'rejected-room');

  // Utan biljett nekas anslutning direkt.
  const rejected = await new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws?room=fake-room`);
    ws.on('close', (code) => resolve(code));
    ws.on('error', () => resolve(4001));
    setTimeout(() => resolve(0), 4000);
  });
  assert.equal(rejected, 4001);
});

test('ej godkänt fall kan inte startas som vanligt rum', async () => {
  const created = await call('u', 'POST', '/builder/cases', {
    title: 'Råutkast', intro: 'Introduktion som är ganska kort.', caseType: 'murder',
    environment: 'hotel', difficulty: 'normal',
  });
  const r = await call('u', 'POST', '/rooms', { caseId: created.data.caseId, mode: 'solo' });
  assert.equal(r.status, 400);
});
