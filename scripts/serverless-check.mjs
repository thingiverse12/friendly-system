// Simulerar Vercel-serverless lokalt: samma funktion som api/index.js, med
// VERCEL-miljö, databas i /tmp och utan statisk katalog eller WebSocket.
process.env.VERCEL = '1';
process.env.DATA_DIR = '/tmp/mordgatan-serverless-check';
process.env.PORT = '0';

import fs from 'node:fs';
import http from 'node:http';
fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true });

const mod = await import('../api/index.js');
const handler = mod.default;
const server = http.createServer(handler);

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const base = `http://127.0.0.1:${port}/api`;
let cookie = '';

async function call(method, p, body) {
  const res = await fetch(base + p, {
    method,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const sc = res.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0];
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

const assert = (c, m) => { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓', m); };

const health = await call('GET', '/health');
assert(health.status === 200 && health.data.runtime === 'vercel-serverless', 'health rapporterar serverless-runtime');

const reg = await call('POST', '/auth/register', { username: `sls${Date.now().toString(36)}`, displayName: 'Serverless', password: 'test12345' });
assert(reg.status === 201, 'registrering fungerar i funktionen');

const catalog = await call('GET', '/cases');
assert(catalog.data.cases.length >= 2, 'officiella fall finns kvar efter kallstart (omseedning)');
assert(!JSON.stringify(catalog).includes('secretMeaning'), 'inget facit i katalogsvaret');

const qs = await call('POST', '/rooms/quickstart', {});
assert(qs.status === 201, 'rum kan skapas');
const rid = qs.data.room.id;

const disc = await call('POST', `/rooms/${rid}/evidence/ev_mobil/discover`, {});
assert(disc.status === 200 && disc.data.created === true, 'bevissäkring fungerar');

const ask = await call('POST', `/rooms/${rid}/interrogations`, { suspectId: 'erik', question: 'Var befann du dig på kvällen?' });
assert(ask.status === 201 && ask.data.answer.length > 10, 'lokala AI-motorn svarar utan externa tjänster');

const acc = await call('POST', `/rooms/${rid}/accusations`, {
  suspectId: 'erik', motive: 'Ekonomiskt motiv – markaffären', evidenceIds: ['ev_mobil', 'ev_markkop', 'ev_sms'], narrative: 'x',
});
assert(acc.status === 201 && acc.data.correct === true && acc.data.solution.culprit.personId === 'erik', 'hel spelcykel går att lösa i serverless');

server.close();
console.log('\nSERVERLESS-KOMPATIBILITET VERIFIERAD ✔');
