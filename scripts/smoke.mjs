// Manuell end-to-end-rökning av hela spelcykeln (används under utveckling).
const BASE = process.env.BASE || 'http://127.0.0.1:8787/api';
const user = { username: `rök${Date.now().toString(36)}`, displayName: 'Röktest', password: 'test12345' };
let cookie = '';

async function api(path, opts = {}) {
  const res = await fetch(BASE + path, {
    method: opts.method || 'GET',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`${res.status} ${path}: ${JSON.stringify(data)}`);
  return data;
}

const assert = (cond, msg) => { if (!cond) throw new Error('ASSERT: ' + msg); console.log('  ✓', msg); };

console.log('1. Registrering och katalog');
await api('/auth/register', { method: 'POST', body: user });
const catalog = await api('/cases');
assert(catalog.cases.length >= 2, 'minst två officiella fall i katalogen');
const skargard = catalog.cases.find((c) => c.slug === 'doden-i-skargarden');
const full = await api(`/cases/${skargard.id}`);
assert(full.case.evidence.length === 11, 'komplett bevismaterial');
assert(!JSON.stringify(full).includes('secretMeaning'), 'hemliga betydelser läcker inte till klienten');
assert(!JSON.stringify(full).includes('isCulprit'), 'gärningsperson läcker inte till klienten');

console.log('2. Starta utredning (snabbstart)');
const qs = await api('/rooms/quickstart', { method: 'POST', body: { difficulty: 'normal' } });
const roomId = qs.room.id;
let state = await api(`/rooms/${roomId}/state`);
assert(state.room.mode === 'solo', 'enspelarrum skapat');
assert(state.discoveredEvidence.length === 0, 'inga bevis upptäckta från start');

console.log('3. Bevissäkring');
const disc = await api(`/rooms/${roomId}/evidence/ev_mobil/discover`, { method: 'POST', body: {} });
assert(disc.created === true, 'bevis säkrat');
const dup = await api(`/rooms/${roomId}/evidence/ev_mobil/discover`, { method: 'POST', body: {} });
assert(dup.created === false, 'idempotent dubblett blockeras');
state = await api(`/rooms/${roomId}/state`);
assert(state.discoveredEvidence.includes('ev_mobil'), 'beviset finns i rumstillståndet');

console.log('4. Förhör: fri fråga, föreslagen fråga, beviskonfrontation');
const a1 = await api(`/rooms/${roomId}/interrogations`, { method: 'POST', body: { suspectId: 'erik', question: 'Var befann du dig på kvällen?' } });
assert(a1.answer.includes('Stockholm'), 'lokala motorn svarar ur kunskapsbanken');
assert(a1.truthful === false, 'lögn markeras serversidigt (ej visat för spelare)');
const a2 = await api(`/rooms/${roomId}/interrogations`, { method: 'POST', body: { suspectId: 'erik', evidenceId: 'ev_mobil' } });
assert(a2.answer.length > 20, 'bevisreaktion returneras');
try {
  await api(`/rooms/${roomId}/interrogations`, { method: 'POST', body: { suspectId: 'erik', evidenceId: 'ev_sms' } });
  throw new Error('borde nekats');
} catch (e) { assert(String(e.message).startsWith('403'), 'konfrontation med ej upptäckt bevis nekas'); }

console.log('5. Bevisbräda med klassificering');
const c1 = await api(`/rooms/${roomId}/connections`, { method: 'POST', body: { nodeA: 'person:erik', nodeB: 'evidence:ev_mobil', motivation: 'telefon på ön' } });
assert(c1.connection.classification === 'supported', 'korrekt samband klassas som underbyggt');
const c2 = await api(`/rooms/${roomId}/connections`, { method: 'POST', body: { nodeA: 'person:sara', nodeB: 'evidence:ev_mobil', motivation: 'test' } });
assert(c2.connection.classification === 'unsupported', 'osammansatt koppling saknar stöd');

console.log('6. Anteckningar och ledtrådar');
const note = await api(`/rooms/${roomId}/notes`, { method: 'POST', body: { kind: 'theory', content: 'Erik ljuger om Stockholm' } });
assert(note.note.id, 'anteckning sparad');
const hint = await api(`/rooms/${roomId}/hints`, { method: 'POST', body: { level: 2 } });
assert(hint.hint.includes('mast'), 'ledtråd nivå 2 returneras');
const assistant = await api(`/rooms/${roomId}/assistant`, { method: 'POST' });
assert(!assistant.answer.includes('ev_sms') || state.discoveredEvidence.includes('ev_sms'), 'assistent läcker inte oupptäckta bevis');

console.log('7. Felaktig och korrekt anklagelse');
const wrong = await api(`/rooms/${roomId}/accusations`, { method: 'POST', body: { suspectId: 'mikael', motive: 'ekonomiska problem', evidenceIds: ['ev_mikael'], narrative: 'Han hade motiv.' } });
assert(wrong.correct === false && wrong.solution === null, 'fel gissning ger inget facit');
const correct = await api(`/rooms/${roomId}/accusations`, {
  method: 'POST',
  body: { suspectId: 'erik', motive: 'Ekonomiskt motiv och att undanröja hotet från markaffären', evidenceIds: ['ev_mobil', 'ev_markkop', 'ev_sms'], narrative: 'Erik lockades till bryggan och slog ner offret.' },
});
assert(correct.correct === true, 'korrekt anklagelse bedöms rätt');
assert(correct.solution.culprit.personId === 'erik', 'facit med gärningsperson returneras');
assert(correct.solution.alternativeExplanations.length === 3, 'alternativa teorier förklaras');

console.log('8. Behörighetskontroll: facit får inte läsas i förtid');
const qs2 = await api('/rooms/quickstart', { method: 'POST', body: {} });
try {
  await api(`/rooms/${qs2.room.id}/solution`);
  throw new Error('borde nekats');
} catch (e) { assert(String(e.message).startsWith('403'), 'facit nekas före anklagelse'); }

console.log('\nALLA RÖKTESTER KLARA ✔');
