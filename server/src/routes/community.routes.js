import { Router } from 'express';
import { run, getOne, getAll, now } from '../db.js';
import { asyncHandler, HttpError } from '../util/errors.js';
import { authRequired, roleRequired, audit } from '../auth.js';
import { id } from '../util/ids.js';
import { getCaseRow } from '../cases/index.js';

export const communityRouter = Router();
communityRouter.use(authRequired);

function assertCaseExists(caseId) {
  const c = getCaseRow(caseId);
  if (!c) throw new HttpError(404, 'Fallet finns inte.');
  return c;
}

// ---- Betyg: en röst per användare och fall (skydd mot upprepad röstning) ----
communityRouter.post('/cases/:id/rating', asyncHandler((req, res) => {
  assertCaseExists(req.params.id);
  const score = Number(req.body?.score);
  if (!Number.isInteger(score) || score < 1 || score > 5) throw new HttpError(400, 'Betyget ska vara 1–5.');
  run(
    `INSERT INTO community_ratings (case_id, user_id, score, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(case_id, user_id) DO UPDATE SET score = excluded.score`,
    [req.params.id, req.user.id, score, now()]);
  const agg = getOne('SELECT COUNT(*) AS n, AVG(score) AS avg FROM community_ratings WHERE case_id = ?', [req.params.id]);
  res.json({ ratingCount: agg.n, ratingAvg: Math.round(agg.avg * 10) / 10 });
}));

communityRouter.get('/cases/:id/rating', asyncHandler((req, res) => {
  assertCaseExists(req.params.id);
  const mine = getOne('SELECT score FROM community_ratings WHERE case_id = ? AND user_id = ?',
    [req.params.id, req.user.id]);
  const agg = getOne('SELECT COUNT(*) AS n, AVG(score) AS avg FROM community_ratings WHERE case_id = ?', [req.params.id]);
  res.json({ myRating: mine?.score || null, ratingCount: agg.n, ratingAvg: Math.round((agg.avg || 0) * 10) / 10 });
}));

// ---- Favoriter ----
communityRouter.post('/cases/:id/favorite', asyncHandler((req, res) => {
  assertCaseExists(req.params.id);
  run('INSERT OR IGNORE INTO favorites (user_id, case_id, created_at) VALUES (?, ?, ?)',
    [req.user.id, req.params.id, now()]);
  res.status(201).json({ ok: true });
}));
communityRouter.delete('/cases/:id/favorite', asyncHandler((req, res) => {
  run('DELETE FROM favorites WHERE user_id = ? AND case_id = ?', [req.user.id, req.params.id]);
  res.json({ ok: true });
}));
communityRouter.get('/me/favorites', asyncHandler((req, res) => {
  const rows = getAll(
    `SELECT c.id, c.title, c.intro, c.slug, c.difficulty, c.case_type AS caseType, c.environment
     FROM favorites f JOIN cases c ON c.id = f.case_id WHERE f.user_id = ? ORDER BY f.created_at DESC`,
    [req.user.id]);
  res.json({ favorites: rows });
}));

// ---- Kommentarer: spoilers döljs tills spelaren aktivt väljer att visa ----
communityRouter.get('/cases/:id/comments', asyncHandler((req, res) => {
  assertCaseExists(req.params.id);
  const rows = getAll(
    `SELECT cm.id, cm.content, cm.spoiler, cm.hidden, cm.created_at, u.display_name, cm.user_id
     FROM comments cm JOIN users u ON u.id = cm.user_id
     WHERE cm.case_id = ? ORDER BY cm.created_at DESC LIMIT 100`, [req.params.id]);
  res.json({
    comments: rows.map((r) => ({
      ...r, spoiler: !!r.spoiler, hidden: !!r.hidden,
      content: r.hidden ? 'Kommentaren har dolts av en moderator.' : r.content,
    })),
  });
}));

communityRouter.post('/cases/:id/comments', asyncHandler((req, res) => {
  assertCaseExists(req.params.id);
  const content = String(req.body?.content || '').trim();
  if (content.length < 2 || content.length > 1000) throw new HttpError(400, 'Kommentaren ska vara 2–1000 tecken.');
  const commentId = id('cm');
  run('INSERT INTO comments (id, case_id, user_id, content, spoiler, hidden, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)',
    [commentId, req.params.id, req.user.id, content, req.body?.spoiler ? 1 : 0, now()]);
  audit(req.user.id, 'comment.create', commentId);
  res.status(201).json({ id: commentId });
}));

// ---- Rapportering ----
communityRouter.post('/reports', asyncHandler((req, res) => {
  const { targetType, targetId, reason } = req.body || {};
  if (!['case', 'comment', 'user'].includes(targetType)) throw new HttpError(400, 'Ogiltig rapporttyp.');
  if (!targetId || !String(reason || '').trim()) throw new HttpError(400, 'Ange anledning.');
  run('INSERT INTO reports (id, target_type, target_id, user_id, reason, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id('rep'), targetType, targetId, req.user.id, String(reason).slice(0, 500), 'open', now()]);
  audit(req.user.id, 'report.create', targetId, { targetType });
  res.status(201).json({ ok: true });
}));

// ---- Moderation ----
communityRouter.get('/moderation/reports', roleRequired('moderator', 'admin'), asyncHandler((_req, res) => {
  res.json({ reports: getAll('SELECT * FROM reports WHERE status = ? ORDER BY created_at DESC', ['open']) });
}));

communityRouter.post('/moderation/action', roleRequired('moderator', 'admin'), asyncHandler((req, res) => {
  const { action, targetType, targetId, note } = req.body || {};
  if (!action || !targetType || !targetId) throw new HttpError(400, 'Ofullständig begäran.');
  if (action === 'hide_comment' && targetType === 'comment') {
    run('UPDATE comments SET hidden = 1 WHERE id = ?', [targetId]);
  } else if (action === 'unpublish_case' && targetType === 'case') {
    run("UPDATE cases SET status = 'unpublished' WHERE id = ?", [targetId]);
  } else if (action === 'dismiss_report') {
    run("UPDATE reports SET status = 'dismissed' WHERE id = ?", [targetId]);
  } else {
    throw new HttpError(400, 'Okänd moderationsåtgärd.');
  }
  run('INSERT INTO moderation_actions (id, moderator_id, action, target_type, target_id, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id('mod'), req.user.id, action, targetType, targetId, String(note || '').slice(0, 500), now()]);
  if (action !== 'dismiss_report') {
    run("UPDATE reports SET status = 'handled' WHERE target_type = ? AND target_id = ? AND status = 'open'",
      [targetType, targetId]);
  }
  audit(req.user.id, 'moderation.action', targetId, { action });
  res.json({ ok: true });
}));
