// AI-providerabstraktion.
// - 'local': helt offline, deterministisk, gratis (standard i utveckling).
// - 'openai-compatible': valfri OpenAI-kompatibel endpoint via miljövariabler.
// Externa anrop får bara ett strikt urval av kontext och svaren valideras och
// faller alltid tillbaka på den lokala motorn. Facit lämnas aldrig ut till modellen.
import { config, aiConfigured } from '../config.js';
import { answerFromKnowledgeBank, validateExternalAnswer, PAUSE_MESSAGE } from './local-engine.js';

async function callOpenAICompatible(systemPrompt, userPrompt) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.ai.timeoutMs);
  try {
    const res = await fetch(`${config.ai.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${config.ai.apiKey}` },
      body: JSON.stringify({
        model: config.ai.model,
        temperature: 0.4,
        max_tokens: 500,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`AI HTTP ${res.status}`);
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== 'string') throw new Error('AI: oväntat svarsformat');
    return text.trim();
  } finally {
    clearTimeout(timer);
  }
}

function buildSystemPrompt(suspectPublic, secretModel, discoveredEvidence) {
  // Modellen får den misstänktes egna kunskap och personlighet – inte andras hemligheter och inte facit.
  return [
    `Du spelar rollen som ${suspectPublic.name}, ${suspectPublic.roleTitle}, i ett svenskt mordgåtespel.`,
    `Bakgrund: ${suspectPublic.publicProfile?.bakgrund || ''}`,
    `Du VET följande (får avslöjas naturligt): ${(secretModel.knows || []).join(' ')}`,
    `Du TROR: ${(secretModel.believes || []).join(' ')}`,
    `Du DÖLJER: ${(secretModel.hides || []).join(' ')}`,
    `Ditt alibi: ${secretModel.alibi?.claim || 'Har inget samlat alibi.'}`,
    `Upptäckta bevis som spelaren får konfrontera dig med: ${discoveredEvidence.map((e) => e.title).join('; ') || 'ännu inga'}.`,
    'Regler: Håll dig strikt till dessa fakta. Hitta inte på nya bevis, personer eller händelser. Svara kort och naturligt på svenska, i första person. Om du inte vet något, svara undvikande men nekande utan att uppfinna fakta.',
  ].join('\n');
}

/**
 * Orkestrerar ett förhörssvar med budget, validering, ett återförsök och
 * garanterad fallback. Kastar aldrig okontrollerade fel till anroparen.
 */
export async function interrogate({ suspectPublic, secretModel, question, evidenceId, discoveredEvidence, externalAllowed }) {
  const fallback = answerFromKnowledgeBank(secretModel, question, evidenceId);
  if (!externalAllowed || !aiConfigured() || !question) return fallback;

  const allowedContext = {
    undiscoveredEvidenceTitles: [], // upptäckta bevis filtreras av anroparen
  };
  const systemPrompt = buildSystemPrompt(suspectPublic, secretModel, discoveredEvidence);
  const userPrompt = evidenceId
    ? `Spelaren konfronterar dig med beviset "${discoveredEvidence.find((e) => e.id === evidenceId)?.title || ''}". Fråga: ${question || 'Vad säger du om det här beviset?'}`
    : `Spelaren frågar: ${question}`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const external = await callOpenAICompatible(systemPrompt, userPrompt);
      if (validateExternalAnswer(external, allowedContext)) {
        return { answer: external, source: 'external_ai', truthful: null };
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[ai] externt anrop misslyckades, försöker igen/faller tillbaka:', err.message);
    }
  }
  return fallback;
}

export { PAUSE_MESSAGE };
