// Serverberäknad poängsättning. Klienten kan aldrig sätta sina egna poäng.
export const SCORE = {
  discoverEvidence: 10,
  hintPenalty: 5,             // per använd ledtråd (jämnar ut sig mot upptäckter)
  connection: { supported: 25, contradiction: 30, plausible: 5, unsupported: 0 },
  correctCulprit: 200,
  correctMotive: 100,
  decisiveEvidence: 25,       // per korrekt utvalt avgörande bevis
  timeBonusMax: 50,
};

export function scoreConnection(classification) {
  return SCORE.connection[classification] ?? 0;
}

export function scoreDiscovery() {
  return SCORE.discoverEvidence;
}

export function scoreHint() {
  return -SCORE.hintPenalty;
}

/**
 * Bedömer en slutlig anklagelse mot den låsta hemliga modellen.
 * Ingång: spelarens val + facit. Returnerar poäng och detaljerad bedömning.
 */
export function evaluateAccusation(input, secret) {
  const detail = { culpritCorrect: false, motiveCorrect: false, evidenceHits: [], evidenceMisses: [] };
  let points = 0;
  detail.culpritCorrect = input.suspectId === secret.solution.culpritId;
  if (detail.culpritCorrect) points += SCORE.correctCulprit;

  const motiveText = (input.motive || '').toLowerCase();
  const keywords = secret.solution.motive.toLowerCase().split(/[ ,.]+/).filter((w) => w.length > 5);
  const hits = keywords.filter((w) => motiveText.includes(w)).length;
  detail.motiveCorrect = motiveText.length >= 12 && hits >= 2;
  if (detail.motiveCorrect) points += SCORE.correctMotive;

  const chosen = new Set(input.evidenceIds || []);
  for (const evId of secret.solution.decisiveEvidence) {
    if (chosen.has(evId)) {
      detail.evidenceHits.push(evId);
      points += SCORE.decisiveEvidence;
    } else {
      detail.evidenceMisses.push(evId);
    }
  }
  const correct = detail.culpritCorrect;
  return { correct, points, detail };
}

export function timeBonus(startedAt, finishedAt, playtimeMin) {
  const elapsedMin = Math.max(1, (new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 60000);
  const ratio = Math.min(1, playtimeMin / Math.max(elapsedMin, 1));
  return Math.round(SCORE.timeBonusMax * ratio);
}
