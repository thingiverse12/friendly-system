import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAccusation, scoreConnection, SCORE, timeBonus } from '../server/src/logic/scoring.js';

const secret = {
  solution: {
    culpritId: 'erik',
    motive: 'Ekonomiskt motiv och undanröjande av hot genom markaffären',
    decisiveEvidence: ['ev_mobil', 'ev_markkop', 'ev_sms'],
  },
};

test('korrekt gärningsperson ger huvudpoäng', () => {
  const r = evaluateAccusation({ suspectId: 'erik', motive: '', evidenceIds: [], narrative: '' }, secret);
  assert.equal(r.correct, true);
  assert.equal(r.detail.culpritCorrect, true);
  assert.ok(r.points >= SCORE.correctCulprit);
});

test('fel person ger ingen lösningspoäng', () => {
  const r = evaluateAccusation({ suspectId: 'mikael', motive: 'pengar', evidenceIds: ['ev_mobil'] }, secret);
  assert.equal(r.correct, false);
  assert.equal(r.detail.culpritCorrect, false);
});

test('motivpoäng kräver innehåll och träffar', () => {
  const good = evaluateAccusation({ suspectId: 'erik', motive: 'Ekonomiskt motiv: markaffären hotades', evidenceIds: [] }, secret);
  assert.equal(good.detail.motiveCorrect, true);
  const bad = evaluateAccusation({ suspectId: 'erik', motive: 'han verkade misstänkt', evidenceIds: [] }, secret);
  assert.equal(bad.detail.motiveCorrect, false);
});

test('avgörande bevis ger poäng per träff och registrerar bommar', () => {
  const r = evaluateAccusation({ suspectId: 'erik', motive: '', evidenceIds: ['ev_mobil', 'ev_sara'] }, secret);
  assert.deepEqual(r.detail.evidenceHits, ['ev_mobil']);
  assert.ok(r.detail.evidenceMisses.includes('ev_markkop'));
});

test('brädkopplingar följer poängmatrisen', () => {
  assert.equal(scoreConnection('supported'), SCORE.connection.supported);
  assert.equal(scoreConnection('contradiction'), SCORE.connection.contradiction);
  assert.equal(scoreConnection('plausible'), SCORE.connection.plausible);
  assert.equal(scoreConnection('unsupported'), 0);
  assert.equal(scoreConnection('okänd'), 0);
});

test('tidsbonus är högre vid snabbare lösning och kapad', () => {
  const start = new Date('2026-01-01T10:00:00Z').toISOString();
  const fast = timeBonus(start, new Date('2026-01-01T10:30:00Z').toISOString(), 120);
  const slow = timeBonus(start, new Date('2026-01-01T13:00:00Z').toISOString(), 120);
  assert.ok(fast > slow);
  assert.ok(fast <= SCORE.timeBonusMax);
});
