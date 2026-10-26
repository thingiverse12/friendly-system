// Deterministisk kvalitetssäkring av falldokument (Kontroll A, C och delar av D).
// Dessa tester är matematiska/logiska – kompletterar (men ersätter inte) manuell granskning.
import { VALIDATION_SEVERITY } from '../../../shared/constants.js';

const f = (severity, code, message) => ({ severity, code, message });

// Grundläggande injektionsmönster i användarskapad text (Kontroll D, grundskydd).
const INJECTION_PATTERNS = [
  /ignorera (alla )?tidigare instruktioner/i,
  /ignore (all )?previous instructions/i,
  /system(?:prompt)?\s*:/i,
  /du är nu (?:en|ett) /i,
  /\bact as\b/i,
];

function scanText(value, findings, pathLabel) {
  if (typeof value !== 'string') return;
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(value)) {
      findings.push(f('warning', 'D_INJECTION',
        `Möjligt instruktionsförsök upptäckt i ${pathLabel}. Texten bör granskas före publicering.`));
    }
  }
}

export function validateCaseDocument(doc) {
  const findings = [];
  const error = (code, message) => findings.push(f('error', code, message));
  const warning = (code, message) => findings.push(f('warning', code, message));
  const info = (code, message) => findings.push(f('info', code, message));

  // --- Grunder ---
  if (!doc?.title || doc.title.trim().length < 4) error('A_TITLE', 'Fallet saknar en giltig titel.');
  if (!doc?.intro || doc.intro.length < 20) error('A_INTRO', 'Introduktionen är för kort för att kunna presentera händelsen.');
  if (!doc.briefing || doc.briefing.length === 0) warning('A_BRIEFING', 'Fallet saknar en inledande briefing.');
  if (!['murder', 'missing', 'suspicious_death', 'cold_case', 'connected'].includes(doc.caseType)) {
    error('A_TYPE', 'Ogiltig falltyp.');
  }
  if (!doc.difficulty) error('A_DIFFICULTY', 'Svårighetsgrad saknas.');

  const persons = doc.persons || [];
  const suspects = persons.filter((p) => p.kind === 'suspect');
  const evidence = doc.evidence || [];
  const events = doc.events || [];
  const personIds = new Set(persons.map((p) => p.personId));
  const evidenceIds = new Set(evidence.map((e) => e.id));
  const eventIds = new Set(events.map((e) => e.id));

  if (suspects.length < 2) error('A_SUSPECTS', 'Ett fall behöver minst två misstänkta.');
  if (evidence.length < 5) error('A_EVIDENCE', 'Ett spelbart fall behöver minst fem bevis.');
  if (events.length < 4) error('A_EVENTS', 'Tidslinjen behöver minst fyra händelser.');

  // --- Kontroll A: tidslinje och ordning ---
  const toMinutes = (t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  let prev = -1;
  let dayOffset = 0; // stöd för tidslinjer som korsar midnatt
  for (const ev of events) {
    if (!/^\d{1,2}:\d{2}$/.test(ev.time)) { error('A_TIME_FORMAT', `Händelsen "${ev.label}" har ogiltigt klockslag.`); continue; }
    let mins = toMinutes(ev.time) + dayOffset * 1440;
    if (mins < prev) {
      if (prev - mins > 180) { dayOffset += 1; mins += 1440; } // tolkas som nästa dygn
      else error('A_TIMELINE_ORDER', `Händelsen "${ev.label}" ligger före föregående händelse i tidslinjen.`);
    }
    prev = mins;
    if (!ev.kind || !['confirmed', 'claimed', 'uncertain'].includes(ev.kind)) {
      error('A_EVENT_KIND', `Händelsen "${ev.label}" saknar giltig källstatus.`);
    }
  }

  // --- Kontroll A: varje ledtråd har definierad betydelse ---
  for (const e of evidence) {
    if (!e.secretMeaning || e.secretMeaning.trim().length < 10) {
      error('A_EVIDENCE_MEANING', `Beviset "${e.title}" saknar en definierad hemlig betydelse.`);
    }
    if (!e.sourceStatus) error('A_EVIDENCE_SOURCE', `Beviset "${e.title}" saknar källstatus.`);
    scanText(e.description, findings, `beviset "${e.title}"`);
  }

  // --- Kontroll A: personmodeller ---
  for (const p of persons) {
    if (!personIds.has(p.personId)) continue;
    scanText(p.publicProfile?.bakgrund, findings, `personen ${p.name}`);
    const s = p.secret || {};
    if (p.kind === 'suspect') {
      if (!s.alibi) error('A_ALIBI', `Misstänkt ${p.name} saknar alibimodell.`);
      if (!Array.isArray(s.questions) || s.questions.length < 3) {
        error('A_QUESTION_BANK', `Misstänkt ${p.name} behöver minst tre fråge-svar i kunskapsbanken.`);
      }
      if (!Array.isArray(s.suggestedQuestions) || s.suggestedQuestions.length < 2) {
        warning('A_SUGGESTED', `Misstänkt ${p.name} bör ha föreslagna frågor.`);
      }
      if (!Array.isArray(s.knows) || s.knows.length === 0) {
        error('A_KNOWS', `Misstänkt ${p.name} saknar "vet"-fält i den hemliga modellen.`);
      }
    }
  }

  // --- Kontroll A/C: facit och beviskedja ---
  const solution = doc.solution;
  if (!solution) {
    error('A_SOLUTION', 'Fallet saknar hemligt facit (solution).');
  } else {
    const culprits = persons.filter((p) => p.secret?.isCulprit);
    if (culprits.length !== 1) {
      error('C_UNIQUE_CULPRIT', `Exakt en gärningsperson måste markeras (hittade ${culprits.length}).`);
    }
    if (!personIds.has(solution.culpritId)) error('A_CULPRIT_ID', 'Facitets person-id finns inte bland fallets personer.');
    const culprit = persons.find((p) => p.personId === solution.culpritId);
    if (culprit && culprit.secret?.isCulprit !== true) {
      error('C_CULPRIT_FLAG', 'Facitets person är inte markerad som gärningsperson i sin hemliga modell.');
    }
    if (!solution.motive || solution.motive.length < 15) error('A_MOTIVE', 'Motivet i facit saknas eller är för kort.');
    if (!solution.narrative || solution.narrative.length < 40) error('A_NARRATIVE', 'Händelseförloppet i facit är för kort.');
    for (const evId of solution.decisiveEvidence || []) {
      if (!evidenceIds.has(evId)) error('A_DECISIVE_REF', `Avgörande bevis "${evId}" finns inte i bevismaterialet.`);
    }
    if ((solution.decisiveEvidence || []).length < 3) {
      error('C_DECISIVE_COUNT', 'Minst tre avgörande bevis behövs för en rättvis lösning.');
    }
    // Varje icke-skyldig misstänkt ska kunna uteslutas med ett styrkt alibi.
    for (const alt of solution.alternativeExplanations || []) {
      if (!personIds.has(alt.personId)) error('C_ALT_ID', `Alternativförklaring refererar okänd person ${alt.personId}.`);
      for (const ref of alt.contradictedBy || []) {
        if (!evidenceIds.has(ref) && !eventIds.has(ref)) {
          error('C_ALT_REF', `Alternativförklaring för ${alt.personId} refererar okänt bevis/händelse "${ref}".`);
        }
      }
    }
    for (const p of suspects.filter((p) => p.personId !== solution.culpritId)) {
      const alibiEvidence = p.secret?.alibi?.evidenceIds || [];
      const confirmed = p.secret?.alibi?.reliability === 'confirmed';
      const hasBacking = alibiEvidence.some((eid) => evidenceIds.has(eid));
      if (!confirmed || !hasBacking) {
        error('C_ALTERNATIVE_SOLUTION',
          `Misstänkt ${p.name} saknar ett styrkt, bevismässigt alibi – då kan flera lösningar passa.`);
      }
    }
  }

  // --- Kontroll A: bevisbrädans länkar ---
  const knownNode = (node) => {
    const [kind, ref] = node.split(':');
    if (kind === 'person') return personIds.has(ref);
    if (kind === 'evidence') return evidenceIds.has(ref);
    if (kind === 'event') return eventIds.has(ref);
    if (kind === 'place') return (doc.locations || []).some((l) => l.id === ref);
    return false;
  };
  for (const link of doc.boardLinks || []) {
    if (!knownNode(link.a) || !knownNode(link.b)) {
      error('A_BOARD_NODE', `Bevisbrädelänken ${link.a} ↔ ${link.b} refererar okända noder.`);
    }
    if (!['supported', 'contradiction'].includes(link.type)) {
      error('A_BOARD_TYPE', `Ogiltig typ på länk ${link.a} ↔ ${link.b}.`);
    }
  }

  // --- Ledtrådar ---
  if (!Array.isArray(doc.hints) || doc.hints.length !== 3) {
    warning('A_HINTS', 'Rekommenderat: exakt tre ledtrådsnivåer.');
  }

  // --- Kontroll D: namnlista över verkliga personer (grundskydd, ej uttömmande) ---
  const protectedNames = ['statsminister', 'justitieminister'];
  for (const p of persons) {
    const lower = (p.name || '').toLowerCase();
    if (protectedNames.some((n) => lower.includes(n))) {
      warning('D_REAL_PERSON', `Namnet "${p.name}" bör ändras för att undvika att verkliga personer pekas ut.`);
    }
  }

  const passed = !findings.some((x) => x.severity === 'error');
  if (passed) info('OK', 'Alla kritiska kontroller passerade. Manuell provspelning rekommenderas ändå innan publicering.');
  return {
    passed,
    findings,
    summary: {
      errors: findings.filter((x) => x.severity === 'error').length,
      warnings: findings.filter((x) => x.severity === 'warning').length,
      infos: findings.filter((x) => x.severity === 'info').length,
      severityLabels: VALIDATION_SEVERITY,
    },
  };
}

// Oberoende "AI-utredare" (Kontroll B): simulering som endast ser offentligt material
// och försöker lösa fallet med de regler en spelare har. Returnerar om facitet är nåbart.
export function independentInvestigatorRun(publicDoc) {
  const steps = [];
  const factEvidence = publicDoc.evidence.filter((e) => e.sourceStatus === 'fact');
  steps.push(`Utredaren har ${publicDoc.evidence.length} bevis och ${publicDoc.persons.filter((p) => p.kind === 'suspect').length} misstänkta att arbeta med.`);
  const alibiBacked = publicDoc.persons
    .filter((p) => p.kind === 'suspect')
    .map((p) => ({ personId: p.personId, name: p.name }));
  steps.push(`Alibigranskning kan riktas mot: ${alibiBacked.map((a) => a.name).join(', ')}.`);
  steps.push(`Bekräftade faktabevis: ${factEvidence.length}. Övriga vilar på vittnesmål eller indicier och måste vägas källkritiskt.`);
  // Kontroll: kan utredaren nå ett slut från enbart offentliga data? (Facit är osynligt här.)
  const reachable = factEvidence.length >= 3 && (publicDoc.boardLinks || []).length >= 5;
  return {
    reachable,
    steps,
    conclusion: reachable
      ? 'Den oberoende utredaren kan bygga en beviskedja från offentligt material. Slutsatsen nås utan att facit läcks.'
      : 'Otillräckligt offentligt underlag – fallet riskerar att bli olösbart utan facit.',
  };
}
