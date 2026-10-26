// Rökning av byggare, community, multiplayer, behörighet och WebSocket.
import { WebSocket } from 'ws';
import { hotellet } from '../server/src/cases/case-hotellet.js';

const BASE = 'http://127.0.0.1:8787/api';
const cookies = new Map();

async function api(as, path, opts = {}) {
  const res = await fetch(BASE + path, {
    method: opts.method || 'GET',
    headers: { 'content-type': 'application/json', ...(cookies.get(as) ? { cookie: cookies.get(as) } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const sc = res.headers.get('set-cookie');
  if (sc) cookies.set(as, sc.split(';')[0]);
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(`${res.status} ${path}: ${JSON.stringify(data)}`), { status: res.status, data });
  return data;
}
const assert = (c, m) => { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓', m); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const uname = (p) => `${p}${Date.now().toString(36)}`;

console.log('1. Konton');
const a = uname('alice'), b = uname('bob');
await api('a', '/auth/register', { method: 'POST', body: { username: a, displayName: 'Alice', password: 'test12345' } });
await api('b', '/auth/register', { method: 'POST', body: { username: b, displayName: 'Bob', password: 'test12345' } });

console.log('2. Fallbyggare: ofullständigt utkast fallerar validering');
const blank = await api('a', '/builder/cases', { method: 'POST', body: { title: 'x', intro: 'kort', caseType: 'murder', environment: 'hotel', difficulty: 'normal' } });
let rep = await api('a', `/builder/cases/${blank.caseId}/validate`, { method: 'POST', body: {} });
assert(rep.passed === false && rep.summary.errors > 0, 'kritiska fel rapporteras');
let blocked = false;
try { await api('a', `/builder/cases/${blank.caseId}/publish`, { method: 'POST', body: {} }); }
catch (e) { blocked = e.status === 422; }
assert(blocked, 'publicering blockeras vid kritiska fel');

console.log('3. Komplett dokument passerar kontroll A–C och publiceras');
const doc = structuredClone(hotellet);
doc.slug = `eget-${Date.now().toString(36)}`;
doc.title = 'Mitt egna hotellfall';
const created = await api('a', '/builder/cases', { method: 'POST', body: doc });
rep = await api('a', `/builder/cases/${created.caseId}/validate`, { method: 'POST', body: {} });
assert(rep.passed === true, `validering godkänd (${rep.summary.errors} fel)`);
assert(rep.investigator.reachable === true, 'oberoende utredaren når en lösning från offentligt material');
await api('a', `/builder/cases/${created.caseId}/publish`, { method: 'POST', body: {} });
const catalog = await api('a', '/cases');
assert(catalog.cases.some((c) => c.id === created.caseId), 'publicerat fall syns i katalogen');

console.log('4. Testläge för skapare');
const testRoom = await api('a', `/builder/cases/${created.caseId}/test-room`, { method: 'POST', body: {} });
assert(testRoom.roomId, 'testrum skapat för utkast');

console.log('5. Multiplayer: samarbetsrum, anslutning och behörighet');
const room = await api('a', '/rooms', { method: 'POST', body: { caseId: created.caseId, mode: 'cooperative', scoreSystem: 'realistic', guessLimit: 0, hintRules: 'on', difficulty: 'normal' } });
const rid = room.room.id, code = room.room.code;
const joined = await api('b', '/rooms/join', { method: 'POST', body: { code } });
assert(joined.room.id === rid, 'Bob ansluter med rumskod');
const stateB = await api('b', `/rooms/${rid}/state`);
assert(stateB.members.length === 2, 'två medlemmar i rummet');

// Bob upptäcker ett bevis – Alice ser det via delat rum (id:t är omskapat vid persistens)
const stateB0 = await api('b', `/rooms/${rid}/state`);
const evId = stateB0.case.evidence[0].id;
await api('b', `/rooms/${rid}/evidence/${evId}/discover`, { method: 'POST', body: {} });
const stateA = await api('a', `/rooms/${rid}/state`);
assert(stateA.discoveredEvidence.includes(evId), 'bevis delas i samarbetsläge');

// Behörighet: Bob kan inte sparka andra
let forbidden = false;
try { await api('b', `/rooms/${rid}/kick`, { method: 'POST', body: { userId: stateA.members.find((m) => m.memberRole === 'host').userId } }); }
catch (e) { forbidden = e.status === 403; }
assert(forbidden, 'icke-värd nekas spelarhantering');

// Bob kan inte läsa facit i förtid
let noSolution = false;
try { await api('b', `/rooms/${rid}/solution`); } catch (e) { noSolution = e.status === 403; }
assert(noSolution, 'facit nekas före anklagelse');

// Värden sparkar Bob – därefter nekas Bob åtkomst
await api('a', `/rooms/${rid}/kick`, { method: 'POST', body: { userId: stateB.members.find((m) => m.displayName === 'Bob').userId } });
let kicked = false;
try { await api('b', `/rooms/${rid}/state`); } catch (e) { kicked = e.status === 403; }
assert(kicked, 'borttagen medlem nekas åtkomst');

console.log('6. WebSocket-närvaro');
const ticket = (await api('a', '/auth/ws-ticket')).ticket;
const ws = new WebSocket(`ws://127.0.0.1:8787/ws?room=${rid}&ticket=${encodeURIComponent(ticket)}`);
const gotConnected = await new Promise((resolve) => {
  ws.on('message', (raw) => { const m = JSON.parse(raw.toString()); if (m.type === 'connected') resolve(true); });
  ws.on('error', () => resolve(false));
  setTimeout(() => resolve(false), 4000);
});
assert(gotConnected, 'klient ansluter via WS och får connected');
ws.close();
await wait(200);

console.log('7. Community: betyg, kommentar, rapportering');
await api('a', `/community/cases/${created.caseId}/rating`, { method: 'POST', body: { score: 4 } });
await api('a', `/community/cases/${created.caseId}/rating`, { method: 'POST', body: { score: 5 } }); // ändra röst
const rating = await api('a', `/community/cases/${created.caseId}/rating`);
assert(rating.myRating === 5 && rating.ratingCount === 1, 'endast en röst per användare räknas');
await api('a', `/community/cases/${created.caseId}/comments`, { method: 'POST', body: { content: 'Spännande upplägg!', spoiler: false } });
const comments = await api('a', `/community/cases/${created.caseId}/comments`);
assert(comments.comments.length === 1, 'kommentar sparad');
await api('a', '/community/reports', { method: 'POST', body: { targetType: 'comment', targetId: comments.comments[0].id, reason: 'Testrapport' } });

console.log('8. Tävlingsläge: privata anteckningar och dolda anklagelser');
const comp = await api('a', '/rooms', { method: 'POST', body: { caseId: created.caseId, mode: 'competitive', scoreSystem: 'competitive', guessLimit: 0, hintRules: 'on', difficulty: 'normal' } });
const cid = comp.room.id;
await api('a', `/rooms/${cid}/notes`, { method: 'POST', body: { kind: 'theory', content: 'Min hemliga teori' } });
await api('b', '/rooms/join', { method: 'POST', body: { code: comp.room.code } });
const bState = await api('b', `/rooms/${cid}/state`);
assert(bState.notes.length === 0, 'privata teorier läcker inte till motståndare');

console.log('\nALLA RÖKTESTER 2 KLARA ✔');
