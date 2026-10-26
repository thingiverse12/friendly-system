// Fallregister: persistens av falldokument till normaliserade tabeller samt
// läsfunktioner med strikt skiljelinje mellan offentligt material och hemliga facit.
import { db, now, run, getOne, getAll, transaction } from '../db.js';
import { id } from '../util/ids.js';
import { skerggarden } from './case-skerggarden.js';
import { hotellet } from './case-hotellet.js';

export const OFFICIAL_CASES = [hotellet, skerggarden];

/**
 * Persisterar ett falldokument som en ny, versionshanterad rad.
 * Hemliga data hamnar i case_suspect_secrets / case_solution_secrets.
 */
export function persistCaseDocument(doc, { creatorId = null, official = false, status = 'draft' } = {}) {
  return transaction(() => {
    let series = getOne('SELECT id FROM case_series WHERE slug = ?', [doc.slug]);
    if (!series) {
      const seriesId = id('ser');
      run('INSERT INTO case_series (id, slug, created_at) VALUES (?, ?, ?)', [seriesId, doc.slug, now()]);
      series = { id: seriesId };
    }
    const lastVersion = getOne('SELECT MAX(version) AS v FROM cases WHERE series_id = ?', [series.id]);
    const version = (lastVersion?.v || 0) + 1;
    const caseId = id('case');
    const ts = now();
    const publicPayload = JSON.stringify({
      image: doc.image || '',
      briefing: doc.briefing || [], hints: doc.hints || [], boardLinks: doc.boardLinks || [],
      assistantInsights: doc.assistantInsights || {}, locations: doc.locations || [],
    });
    run(
      `INSERT INTO cases (id, series_id, version, title, slug, intro, case_type, environment, difficulty,
        playtime_min, language, status, locked, official, creator_id, public_payload, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sv', ?, ?, ?, ?, ?, ?, ?)`,
      [caseId, series.id, version, doc.title, doc.slug, doc.intro, doc.caseType, doc.environment,
        doc.difficulty, doc.playtimeMin || 60, status, status === 'approved' ? 1 : 0,
        official ? 1 : 0, creatorId, publicPayload, ts, ts],
    );

    for (const [i, person] of (doc.persons || []).entries()) {
      const rowId = id('cs');
      const { secret, ...publicProfile } = person;
      run(
        `INSERT INTO case_suspects (id, case_id, person_id, sort_order, public_profile)
         VALUES (?, ?, ?, ?, ?)`,
        [rowId, caseId, person.personId, i, JSON.stringify(publicProfile)],
      );
      run('INSERT INTO case_suspect_secrets (suspect_row_id, secret_model) VALUES (?, ?)',
        [rowId, JSON.stringify(secret || {})]);
    }
    for (const [i, ev] of (doc.events || []).entries()) {
      run(
        `INSERT INTO case_events (id, case_id, sort_order, event_time, label, detail, kind, is_public, secret_note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [ev.id, caseId, i, ev.time, ev.label, ev.detail || '', ev.kind, ev.isPublic === false ? 0 : 1, ev.secretNote || ''],
      );
    }
    for (const [i, e] of (doc.evidence || []).entries()) {
      run(
        `INSERT INTO case_evidence (id, case_id, sort_order, category, title, description, source_status,
          location, image, discover_hint, secret_meaning)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [e.id, caseId, i, e.category, e.title, e.description, e.sourceStatus, e.location || '',
          e.image || '', e.discoverHint || '', e.secretMeaning || ''],
      );
    }
    for (const ws of doc.witnessStatements || []) {
      run('INSERT INTO case_witness_statements (id, case_id, person_id, content, reliability) VALUES (?, ?, ?, ?, ?)',
        [ws.id, caseId, ws.personId, ws.content, ws.reliability || 'medium']);
    }
    if (doc.solution) {
      const s = doc.solution;
      run(
        `INSERT INTO case_solution_secrets (case_id, culprit_id, motive, narrative, real_timeline,
          decisive_evidence, alternative_explanations, locked)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [caseId, s.culpritId, s.motive || '', s.narrative || '', JSON.stringify(s.realTimeline || []),
          JSON.stringify(s.decisiveEvidence || []), JSON.stringify(s.alternativeExplanations || []),
          status === 'approved' ? 1 : 0],
      );
    }
    return getCaseRow(caseId);
  });
}

export function getCaseRow(caseId) {
  return getOne('SELECT * FROM cases WHERE id = ?', [caseId]);
}

export function getCaseBySeriesLatest(slug) {
  return getOne(`SELECT c.* FROM cases c JOIN case_series s ON s.id = c.series_id
                 WHERE s.slug = ? ORDER BY c.version DESC LIMIT 1`, [slug]);
}

function ratingSummary(caseId) {
  const row = getOne(
    'SELECT COUNT(*) AS n, COALESCE(AVG(score), 0) AS avg FROM community_ratings WHERE case_id = ?', [caseId]);
  return { ratingCount: row?.n || 0, ratingAvg: Math.round((row?.avg || 0) * 10) / 10 };
}

/** Offentlig listvy – aldrig något facit. */
export function listPublicCases({ type, environment, difficulty, sort = 'popular', q, includeUnapproved = false } = {}) {
  const where = [];
  const params = [];
  if (!includeUnapproved) where.push("c.status = 'approved'");
  if (type) { where.push('c.case_type = ?'); params.push(type); }
  if (environment) { where.push('c.environment = ?'); params.push(environment); }
  if (difficulty) { where.push('c.difficulty = ?'); params.push(difficulty); }
  if (q) { where.push('(c.title LIKE ? OR c.intro LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  const order = sort === 'newest' ? 'c.created_at DESC' : 'c.official DESC, c.created_at DESC';
  const rows = getAll(
    `SELECT c.* FROM cases c ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ${order}`, params);
  const mapped = rows.map((r) => ({
    id: r.id, title: r.title, intro: r.intro, slug: r.slug, caseType: r.case_type,
    environment: r.environment, difficulty: r.difficulty, playtimeMin: r.playtime_min,
    image: JSON.parse(r.public_payload).image || '', status: r.status, official: !!r.official,
    version: r.version, ...ratingSummary(r.id),
  }));
  if (sort === 'rating' || sort === 'popular') {
    mapped.sort((a, b) => b.ratingAvg - a.ratingAvg || b.ratingCount - a.ratingCount);
  }
  return mapped;
}

function personsForCase(caseId, { withSecrets = false } = {}) {
  const rows = getAll(
    `SELECT s.person_id, s.sort_order, s.public_profile, x.secret_model
     FROM case_suspects s LEFT JOIN case_suspect_secrets x ON x.suspect_row_id = s.id
     WHERE s.case_id = ? ORDER BY s.sort_order`, [caseId]);
  return rows.map((r) => {
    const base = JSON.parse(r.public_profile);
    const secret = JSON.parse(r.secret_model || '{}');
    // Föreslagna frågor är trygga att visa offentligt (facit avslöjas inte).
    if (Array.isArray(secret.suggestedQuestions)) base.suggestedQuestions = secret.suggestedQuestions;
    if (withSecrets) base.secret = secret;
    return base;
  });
}

/** Offentligt fallpaket – tryggt att skicka till klient. Hemliga fält exkluderade medvetet. */
export function getPublicCase(caseId) {
  const c = getCaseRow(caseId);
  if (!c) return null;
  const payload = JSON.parse(c.public_payload);
  const persons = personsForCase(caseId, { withSecrets: false });
  const events = getAll(
    'SELECT id, event_time AS time, label, detail, kind FROM case_events WHERE case_id = ? AND is_public = 1 ORDER BY sort_order',
    [caseId]);
  const evidence = getAll(
    `SELECT id, category, title, description, source_status AS sourceStatus, location, image, discover_hint AS discoverHint
     FROM case_evidence WHERE case_id = ? ORDER BY sort_order`, [caseId]);
  const statements = getAll(
    'SELECT id, person_id AS personId, content, reliability FROM case_witness_statements WHERE case_id = ?', [caseId]);
  return {
    id: c.id, seriesId: c.series_id, version: c.version, title: c.title, slug: c.slug,
    intro: c.intro, caseType: c.case_type, environment: c.environment, difficulty: c.difficulty,
    playtimeMin: c.playtime_min, status: c.status, official: !!c.official, locked: !!c.locked,
    image: payload.image || '', briefing: payload.briefing, locations: payload.locations,
    hints: payload.hints, boardLinks: payload.boardLinks, assistantInsights: payload.assistantInsights,
    persons, events, evidence, witnessStatements: statements,
  };
}

/** Serversidan: hemlig modell. Får aldrig passera till klient direkt. */
export function getSecretCase(caseId) {
  const c = getCaseRow(caseId);
  if (!c) return null;
  const persons = personsForCase(caseId, { withSecrets: true });
  const secretRow = getOne('SELECT * FROM case_solution_secrets WHERE case_id = ?', [caseId]);
  const evidenceRows = getAll('SELECT id, title, secret_meaning AS secretMeaning FROM case_evidence WHERE case_id = ?', [caseId]);
  const secretEvents = getAll(
    'SELECT id, event_time AS time, label, secret_note AS secretNote FROM case_events WHERE case_id = ? ORDER BY sort_order',
    [caseId]);
  if (!secretRow) return { ...c, persons, evidence: evidenceRows, events: secretEvents, solution: null };
  return {
    id: caseId,
    persons,
    evidence: evidenceRows,
    events: secretEvents,
    solution: {
      culpritId: secretRow.culprit_id,
      motive: secretRow.motive,
      narrative: secretRow.narrative,
      realTimeline: JSON.parse(secretRow.real_timeline),
      decisiveEvidence: JSON.parse(secretRow.decisive_evidence),
      alternativeExplanations: JSON.parse(secretRow.alternative_explanations),
    },
  };
}

export function getSuspectSecret(caseId, personId) {
  const row = getOne(
    `SELECT x.secret_model FROM case_suspect_secrets x
     JOIN case_suspects s ON s.id = x.suspect_row_id
     WHERE s.case_id = ? AND s.person_id = ?`, [caseId, personId]);
  return row ? JSON.parse(row.secret_model) : null;
}

export function getBoardGroundTruth(caseId) {
  const c = getCaseRow(caseId);
  return c ? JSON.parse(c.public_payload).boardLinks || [] : [];
}

export function getHint(caseId, level) {
  const c = getCaseRow(caseId);
  if (!c) return null;
  const hints = JSON.parse(c.public_payload).hints || [];
  return hints[Math.max(0, Math.min(level - 1, hints.length - 1))] || null;
}

export function seedOfficialContent() {
  const campaigns = getAll('SELECT id FROM campaigns');
  for (const doc of OFFICIAL_CASES) {
    if (!getCaseBySeriesLatest(doc.slug)) {
      persistCaseDocument(doc, { official: true, status: 'approved' });
    }
  }
  if (!campaigns.length) {
    const campaignId = id('camp');
    run('INSERT INTO campaigns (id, slug, title, description) VALUES (?, ?, ?, ?)', [
      campaignId, 'sanningen-bakom-tystnaden', 'Sanningen bakom tystnaden',
      'En sammanhängande berättelse där spåren från ett isolerat fjällhotell leder vidare ut i Stockholms skärgård. Val du gör i utredningarna noteras i din kampanjjournal.',
    ]);
    const ordinalCases = ['hotell-silversolen', 'doden-i-skargarden'];
    ordinalCases.forEach((slug, i) => {
      const c = getCaseBySeriesLatest(slug);
      if (c) run('INSERT INTO campaign_cases (campaign_id, case_id, ordinal) VALUES (?, ?, ?)',
        [campaignId, c.id, i + 1]);
    });
  }
}

/**
 * Ger nya globalt unika id åt bevis, händelser och vittnesmål i ett användarskapat dokument
 * och skriver om alla referenser. Person-id behålls (unikt inom fallet).
 * Detta förhindrar primärnyckelkollisioner när användare återanvänder ett officiellt fall som mall.
 */
export function rewriteDocumentIds(doc) {
  const next = structuredClone(doc);
  const evMap = new Map((next.evidence || []).map((e) => [e.id, id('ev')]));
  const eventMap = new Map((next.events || []).map((e) => [e.id, id('evt')]));
  const mapRef = (ref) => {
    const [kind, value] = ref.includes(':') ? ref.split(':') : [null, ref];
    if (kind === 'evidence') return `evidence:${evMap.get(value) || value}`;
    if (kind === 'event') return `event:${eventMap.get(value) || value}`;
    if (evMap.has(value)) return evMap.get(value);
    if (eventMap.has(value)) return eventMap.get(value);
    return ref;
  };
  next.evidence = (next.evidence || []).map((e) => ({ ...e, id: evMap.get(e.id) }));
  next.events = (next.events || []).map((e) => ({ ...e, id: eventMap.get(e.id) }));
  next.witnessStatements = (next.witnessStatements || []).map((w) => ({ ...w, id: id('ws') }));
  next.boardLinks = (next.boardLinks || []).map((l) => ({ ...l, a: mapRef(l.a), b: mapRef(l.b) }));
  if (next.assistantInsights) {
    next.assistantInsights = Object.fromEntries(
      Object.entries(next.assistantInsights).map(([k, v]) => [evMap.get(k) || k, v]));
  }
  for (const p of next.persons || []) {
    const s = p.secret;
    if (!s) continue;
    if (s.alibi?.evidenceIds) s.alibi.evidenceIds = s.alibi.evidenceIds.map((x) => evMap.get(x) || x);
    if (s.evidenceReactions) {
      s.evidenceReactions = Object.fromEntries(
        Object.entries(s.evidenceReactions).map(([k, v]) => [evMap.get(k) || k, v]));
    }
  }
  if (next.solution) {
    next.solution.decisiveEvidence = (next.solution.decisiveEvidence || []).map((x) => evMap.get(x) || x);
    next.solution.alternativeExplanations = (next.solution.alternativeExplanations || [])
      .map((a) => ({ ...a, contradictedBy: (a.contradictedBy || []).map(mapRef) }));
  }
  return next;
}

/** Rekonstruerar ett komplett falldokument (inkl. hemligheter) för editorn/testläge. */
export function reconstructCaseDocument(caseId) {
  const c = getCaseRow(caseId);
  if (!c) return null;
  const payload = JSON.parse(c.public_payload);
  const persons = personsForCase(caseId, { withSecrets: true });
  const events = getAll('SELECT id, event_time AS time, label, detail, kind, is_public AS isPublic, secret_note AS secretNote FROM case_events WHERE case_id = ? ORDER BY sort_order', [caseId])
    .map((e) => ({ ...e, isPublic: !!e.isPublic }));
  const evidence = getAll('SELECT id, category, title, description, source_status AS sourceStatus, location, image, discover_hint AS discoverHint, secret_meaning AS secretMeaning FROM case_evidence WHERE case_id = ? ORDER BY sort_order', [caseId]);
  const witnessStatements = getAll('SELECT id, person_id AS personId, content, reliability FROM case_witness_statements WHERE case_id = ?', [caseId]);
  const secretRow = getOne('SELECT * FROM case_solution_secrets WHERE case_id = ?', [caseId]);
  return {
    slug: c.slug, title: c.title, intro: c.intro, caseType: c.case_type, environment: c.environment,
    difficulty: c.difficulty, playtimeMin: c.playtime_min,
    briefing: payload.briefing || [], locations: payload.locations || [],
    hints: payload.hints || [], boardLinks: payload.boardLinks || [],
    assistantInsights: payload.assistantInsights || {},
    persons, events, evidence, witnessStatements,
    solution: secretRow ? {
      culpritId: secretRow.culprit_id, motive: secretRow.motive, narrative: secretRow.narrative,
      realTimeline: JSON.parse(secretRow.real_timeline),
      decisiveEvidence: JSON.parse(secretRow.decisive_evidence),
      alternativeExplanations: JSON.parse(secretRow.alternative_explanations),
    } : null,
  };
}

export function recordValidationRun(caseId, report) {
  return transaction(() => {
    const runId = id('val');
    run('INSERT INTO case_validation_runs (id, case_id, created_at, passed, report) VALUES (?, ?, ?, ?, ?)',
      [runId, caseId, now(), report.passed ? 1 : 0, JSON.stringify(report)]);
    for (const f of report.findings) {
      run('INSERT INTO case_validation_findings (id, run_id, severity, code, message) VALUES (?, ?, ?, ?, ?)',
        [id('vf'), runId, f.severity, f.code, f.message]);
    }
    return runId;
  });
}

export function getLatestValidation(caseId) {
  const r = getOne(
    'SELECT * FROM case_validation_runs WHERE case_id = ? ORDER BY created_at DESC LIMIT 1', [caseId]);
  if (!r) return null;
  return { id: r.id, passed: !!r.passed, createdAt: r.created_at, ...JSON.parse(r.report) };
}

export { db };
