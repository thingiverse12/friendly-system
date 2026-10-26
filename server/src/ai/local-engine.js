// ============================================================================
// Inbyggd, deterministisk AI-motor ("local engine").
// ALLA svar härleds från den låsta falldokumentets kunskapsbank – motorn
// hittar aldrig på nya fakta, flyttar inga händelser och känner inte till mer
// än den enskilde misstänktes hemliga modell. Den är det garanterade reservsvaret.
// ============================================================================

function normalize(text) {
  return (text || '').toLowerCase().replace(/[?!.,…:"'´`]/g, ' ').replace(/\s+/g, ' ').trim();
}

function hashPick(lines, seed) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return lines[h % lines.length];
}

/**
 * Besvarar en fråga till en misstänkt.
 * @param secret  den misstänktes hemliga modell (serversidan)
 * @param question spelarens fråga
 * @param evidenceId  om spelaren konfronterar med ett bevis
 */
export function answerFromKnowledgeBank(secret, question, evidenceId = null) {
  if (!secret || typeof secret !== 'object') {
    return { answer: PAUSE_MESSAGE, source: 'paused', truthful: null };
  }
  // Beviskonfrontation har högst prioritet.
  if (evidenceId) {
    const reaction = secret.evidenceReactions?.[evidenceId];
    if (reaction) return { answer: reaction, source: 'evidence_reaction', truthful: null };
    // Validerat reservsvar: ingen reaktion definierad → ingen ny fakta.
    return {
      answer: 'Jag vet inte vad det där har med saken att göra. Jag har inget att kommentera om just det.',
      source: 'validated_fallback', truthful: null,
    };
  }

  const q = normalize(question);
  if (!q) {
    return { answer: hashPick(secret.genericLines || DEFAULT_GENERIC, question || ''), source: 'validated_fallback', truthful: null };
  }
  let best = null;
  let bestScore = 0;
  for (const entry of secret.questions || []) {
    const score = entry.keywords.reduce((acc, kw) => acc + (q.includes(normalize(kw)) ? 1 : 0), 0);
    if (score > bestScore) { best = entry; bestScore = score; }
  }
  if (best && bestScore > 0) {
    return { answer: best.answer, source: 'knowledge_bank', truthful: best.truthful };
  }
  const lines = secret.genericLines?.length ? secret.genericLines : DEFAULT_GENERIC;
  return { answer: hashPick(lines, question), source: 'validated_fallback', truthful: null };
}

const DEFAULT_GENERIC = [
  'Jag har inget att tillägga om det.',
  'Jag kan bara svara på det jag faktiskt vet något om.',
  'Den frågan kan jag inte hjälpa dig med.',
];

export const PAUSE_MESSAGE =
  'Förhöret kan för tillfället inte fortsätta på ett säkert sätt. Dina tidigare svar är sparade – försök igen om en stund.';

/**
 * Utredningsassistenten. Ser bara upptäckta bevis och deras förberedda insikter.
 * Hemliga fakta om oupptäckta bevis når aldrig denna funktion.
 */
export function assistantReply(publicCase, discoveredIds) {
  const discovered = publicCase.evidence.filter((e) => discoveredIds.includes(e.id));
  if (!discovered.length) {
    return {
      answer:
        'Du har ännu inte säkrat några bevis. Börja med de rättsmedicinska rapporterna och tekniska loggarna – de ger dig den tidsram inom vilken allt annat måste passa. Sedan granskar vi alibin mot den ramen.',
      source: 'assistant',
    };
  }
  const insights = discovered
    .map((e) => publicCase.assistantInsights?.[e.id])
    .filter(Boolean);
  const unique = [...new Set(insights)];
  const answer = [
    'Baserat enbart på de bevis du själv upptäckt:',
    ...unique.slice(0, 6).map((t, i) => `${i + 1}. ${t}`),
    'Kom ihåg: en persons påstående är ett vittnesmål, inte ett faktum, förrän det styrkts. Jag kan inte avslöja något du inte själv hittat.',
  ].join('\n');
  return { answer, source: 'assistant' };
}

/** Validerar att ett externt AI-svar är säkert och inte läcker otillåten information. */
export function validateExternalAnswer(answer, allowedContext) {
  if (typeof answer !== 'string' || answer.trim().length < 2) return false;
  if (answer.length > 1800) return false;
  const forbiddenTitles = allowedContext.undiscoveredEvidenceTitles || [];
  const lower = answer.toLowerCase();
  for (const title of forbiddenTitles) {
    const key = title.toLowerCase().slice(0, 24);
    if (key.length > 8 && lower.includes(key)) return false;
  }
  // Får inte presentera hemliga strukturfält.
  if (/\b(secret|isculprit|decisiveevidence|facit)\b/.test(lower)) return false;
  return true;
}
