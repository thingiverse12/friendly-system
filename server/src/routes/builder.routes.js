import { Router } from 'express';
import { getOne, getAll, run, now } from '../db.js';
import { asyncHandler, HttpError } from '../util/errors.js';
import { authRequired, audit } from '../auth.js';
import {
  persistCaseDocument, getCaseRow, reconstructCaseDocument,
  recordValidationRun, getLatestValidation, rewriteDocumentIds,
} from '../cases/index.js';
import { validateCaseDocument, independentInvestigatorRun } from '../logic/validation.js';
import { createRoom } from '../services/investigation.js';
import { CASE_TYPES, ENVIRONMENTS, DIFFICULTIES } from '../../../shared/constants.js';

export const builderRouter = Router();
builderRouter.use(authRequired);

const clamp = (v, n) => String(v ?? '').slice(0, n);

// Grundläggande sanering. Den djupa logiska kontrollen görs av validateCaseDocument.
function normalizeDocument(body, user) {
  if (!body || typeof body !== 'object') throw new HttpError(400, 'Inget falldokument skickat.');
  if (!CASE_TYPES[body.caseType]) throw new HttpError(400, 'Ogiltig falltyp.');
  if (!ENVIRONMENTS[body.environment]) throw new HttpError(400, 'Ogiltig miljö.');
  if (!DIFFICULTIES[body.difficulty]) throw new HttpError(400, 'Ogiltig svårighetsgrad.');
  const doc = structuredClone(body);
  doc.title = clamp(doc.title, 120);
  doc.intro = clamp(doc.intro, 600);
  doc.slug = doc.slug || `utkast-${user.id.slice(-6)}-${Math.random().toString(36).slice(2, 8)}`;
  doc.playtimeMin = Math.min(600, Math.max(15, Number(doc.playtimeMin) || 60));
  doc.briefing = (doc.briefing || []).map((b) => clamp(b, 1200)).slice(0, 6);
  doc.persons = (doc.persons || []).map((p) => ({
    ...p,
    name: clamp(p.name, 80), roleTitle: clamp(p.roleTitle, 120),
    publicProfile: p.publicProfile || {}, secret: p.secret || {},
  }));
  doc.evidence = (doc.evidence || []).map((e) => ({
    ...e, title: clamp(e.title, 160), description: clamp(e.description, 3000),
    secretMeaning: clamp(e.secretMeaning, 1000),
  }));
  doc.events = (doc.events || []).map((e) => ({ ...e, label: clamp(e.label, 160), detail: clamp(e.detail, 1000) }));
  doc.hints = (doc.hints || []).map((h) => clamp(h, 800)).slice(0, 3);
  return doc;
}

function assertOwner(caseRow, user) {
  if (!caseRow) throw new HttpError(404, 'Fallet finns inte.');
  if (caseRow.creator_id !== user.id && user.role === 'user') {
    throw new HttpError(403, 'Du har inte behörighet till det här utkastet.');
  }
}

builderRouter.get('/cases', asyncHandler((req, res) => {
  const rows = getAll('SELECT * FROM cases WHERE creator_id = ? ORDER BY updated_at DESC', [req.user.id]);
  res.json({
    cases: rows.map((c) => ({
      id: c.id, title: c.title, status: c.status, version: c.version, slug: c.slug,
      caseType: c.case_type, environment: c.environment, difficulty: c.difficulty,
      updatedAt: c.updated_at, validation: getLatestValidation(c.id),
    })),
  });
}));

builderRouter.post('/cases', asyncHandler((req, res) => {
  const doc = rewriteDocumentIds(normalizeDocument(req.body, req.user));
  const row = persistCaseDocument(doc, { creatorId: req.user.id, official: false, status: 'draft' });
  audit(req.user.id, 'builder.create', row.id);
  res.status(201).json({ caseId: row.id, version: row.version });
}));

builderRouter.get('/cases/:id', asyncHandler((req, res) => {
  const row = getCaseRow(req.params.id);
  assertOwner(row, req.user);
  res.json({ document: reconstructCaseDocument(row.id), meta: { version: row.version, status: row.status }, validation: getLatestValidation(row.id) });
}));

// Att redigera ett publicerat fall skapar en NY version (versionslåsning).
builderRouter.put('/cases/:id', asyncHandler((req, res) => {
  const existing = getCaseRow(req.params.id);
  assertOwner(existing, req.user);
  const doc = rewriteDocumentIds(normalizeDocument(req.body, req.user));
  doc.slug = existing.slug; // samma series → ny version
  const newStatus = existing.status === 'approved' ? 'reredview' : 'draft';
  const row = persistCaseDocument(doc, { creatorId: req.user.id, official: false, status: newStatus });
  run('UPDATE cases SET updated_at = ? WHERE id = ?', [now(), row.id]);
  audit(req.user.id, 'builder.new_version', row.id, { previous: existing.id });
  res.json({ caseId: row.id, version: row.version, status: row.status });
}));

builderRouter.post('/cases/:id/validate', asyncHandler((req, res) => {
  const row = getCaseRow(req.params.id);
  assertOwner(row, req.user);
  const doc = reconstructCaseDocument(row.id);
  const report = validateCaseDocument(doc);
  const investigator = independentInvestigatorRun({
    ...doc,
    // Kontroll B ser bara offentligt material – hemligheter filtreras bort.
    persons: doc.persons.map(({ secret, ...pub }) => pub),
  });
  report.investigator = investigator;
  recordValidationRun(row.id, report);
  res.json(report);
}));

builderRouter.post('/cases/:id/publish', asyncHandler((req, res) => {
  const row = getCaseRow(req.params.id);
  assertOwner(row, req.user);
  const doc = reconstructCaseDocument(row.id);
  const report = validateCaseDocument(doc);
  recordValidationRun(row.id, report);
  if (!report.passed) {
    throw new HttpError(422, 'Publicering blockerad: åtgärda de kritiska felen först.', report.findings.filter((f) => f.severity === 'error'));
  }
  run("UPDATE cases SET status = 'approved', locked = 1, updated_at = ? WHERE id = ?", [now(), row.id]);
  run('UPDATE case_solution_secrets SET locked = 1 WHERE case_id = ?', [row.id]);
  audit(req.user.id, 'builder.publish', row.id);
  res.json({ ok: true, caseId: row.id, status: 'approved' });
}));

// Testläge: skapa ett tillfälligt enspelarrum även för ett ej publicerat utkast.
builderRouter.post('/cases/:id/test-room', asyncHandler((req, res) => {
  const row = getCaseRow(req.params.id);
  assertOwner(row, req.user);
  const room = createRoom(req.user, {
    caseId: row.id, mode: 'solo', scoreSystem: 'realistic',
    guessLimit: 0, hintRules: 'on', difficulty: row.difficulty,
  }, { allowDraft: true });
  res.status(201).json({ roomId: room.id });
}));
