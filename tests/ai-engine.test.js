import { test } from 'node:test';
import assert from 'node:assert/strict';
import { answerFromKnowledgeBank, assistantReply, validateExternalAnswer } from '../server/src/ai/local-engine.js';
import { skerggarden } from '../server/src/cases/case-skerggarden.js';

const erik = skerggarden.persons.find((p) => p.personId === 'erik');
const sara = skerggarden.persons.find((p) => p.personId === 'sara');

test('fri fråga matchar kunskapsbank och behåller sanningsvärde', () => {
  const lie = answerFromKnowledgeBank(erik.secret, 'Var befann du dig på kvällen?');
  assert.equal(lie.source, 'knowledge_bank');
  assert.equal(lie.truthful, false);
  assert.ok(lie.answer.includes('Stockholm'));

  const truth = answerFromKnowledgeBank(sara.secret, 'Var befann du dig mellan 21 och 23?');
  assert.equal(truth.truthful, true);
});

test('beviskonfrontation använder definierad reaktion', () => {
  const r = answerFromKnowledgeBank(erik.secret, 'Vad säger du?', 'ev_mobil');
  assert.equal(r.source, 'evidence_reaction');
  assert.ok(r.answer.toLowerCase().includes('mast'));
});

test('okänd fråga ger validerat reservsvar utan nya fakta', () => {
  const r = answerFromKnowledgeBank(erik.secret, 'Vad är din bankkod och din barndomshund?');
  assert.equal(r.source, 'validated_fallback');
  assert.ok(r.answer.length > 0);
  // Inga fakta som inte finns i modellen kan introduceras.
  assert.ok(!r.answer.includes('ev_mobil'));
});

test('konfrontation med odefinierat bevis uppfinner inga fakta', () => {
  const r = answerFromKnowledgeBank(erik.secret, '?', 'ev_som_inte_finns');
  assert.equal(r.source, 'validated_fallback');
});

test('assistenten ser bara upptäckta bevis', () => {
  const empty = assistantReply(skerggarden, []);
  assert.ok(empty.answer.includes('inga bevis') || empty.answer.includes('ännu inte'));

  const one = assistantReply(skerggarden, ['ev_mobil']);
  assert.ok(one.answer.includes('mast'));
  // Insikter kopplade till oupptäckta bevis får inte läcka.
  const secretInsight = skerggarden.assistantInsights.ev_knapp;
  assert.ok(!one.answer.includes(secretInsight.slice(0, 30)));
});

test('externa svar valideras mot otillåten information', () => {
  const ok = validateExternalAnswer('Ett kort svar utan hemligheter.', { undiscoveredEvidenceTitles: ['Markköpsavtal med hemlig notering'] });
  assert.equal(ok, true);
  const leak = validateExternalAnswer('Titta på Markköpsavtal med hemlig notering direkt.', { undiscoveredEvidenceTitles: ['Markköpsavtal med hemlig notering'] });
  assert.equal(leak, false);
  const structural = validateExternalAnswer('the isCulprit flag is true', { undiscoveredEvidenceTitles: [] });
  assert.equal(structural, false);
});

test('pausmeddelande finns när säker fortsättning saknas', () => {
  assert.ok(PAUSE_MESSAGE_CHECK());
  function PAUSE_MESSAGE_CHECK() {
    return answerFromKnowledgeBank(null, 'hej').answer.length > 0;
  }
});
