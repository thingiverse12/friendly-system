import { Router } from 'express';
import { run, getOne, getAll, now } from '../db.js';
import { asyncHandler, HttpError } from '../util/errors.js';
import { authRequired } from '../auth.js';
import { listPublicCases, getPublicCase } from '../cases/index.js';

export const casesRouter = Router();

// Sökbar katalog med filter (typ, miljö, svårighetsgrad, sortering, fritext).
casesRouter.get('/', asyncHandler((req, res) => {
  const { type, environment, difficulty, sort, q } = req.query;
  const cases = listPublicCases({ type, environment, difficulty, sort, q });
  res.json({ cases });
}));

casesRouter.get('/:caseId', asyncHandler((req, res) => {
  const pub = getPublicCase(req.params.caseId);
  if (!pub || pub.status !== 'approved') throw new HttpError(404, 'Fallet finns inte eller är inte publicerat.');
  res.json({ case: pub });
}));

// Kampanj: innehåll och spelarens framsteg.
casesRouter.get('/campaigns/active', authRequired, asyncHandler((req, res) => {
  const campaign = getOne('SELECT * FROM campaigns ORDER BY rowid LIMIT 1');
  if (!campaign) return res.json({ campaign: null });
  const entries = getAll(
    `SELECT cc.ordinal, c.id AS case_id, c.title, c.intro, c.difficulty, c.image, c.slug
     FROM campaign_cases cc JOIN cases c ON c.id = cc.case_id
     WHERE cc.campaign_id = ? ORDER BY cc.ordinal`, [campaign.id]);
  const progress = getOne('SELECT * FROM campaign_progress WHERE user_id = ? AND campaign_id = ?',
    [req.user.id, campaign.id]);
  res.json({
    campaign: {
      id: campaign.id, slug: campaign.slug, title: campaign.title, description: campaign.description,
      entries: entries.map((e) => ({ ...e, image: undefined, imageUrl: e.image })),
      progress: progress ? {
        currentOrdinal: progress.current_ordinal,
        completed: JSON.parse(progress.completed_cases),
        decisions: JSON.parse(progress.decisions),
      } : { currentOrdinal: 1, completed: [], decisions: [] },
      lockedChapters: [3, 4, 5].map((ordinal) => ({
        ordinal, title: `Kapitel ${ordinal}`, status: 'coming_soon',
      })),
    },
  });
}));

casesRouter.post('/campaigns/:campaignId/complete/:caseId', authRequired, asyncHandler((req, res) => {
  const { campaignId, caseId } = req.params;
  const entry = getOne('SELECT * FROM campaign_cases WHERE campaign_id = ? AND case_id = ?', [campaignId, caseId]);
  if (!entry) throw new HttpError(404, 'Fallet ingår inte i kampanjen.');
  const existing = getOne('SELECT * FROM campaign_progress WHERE user_id = ? AND campaign_id = ?',
    [req.user.id, campaignId]);
  const ts = now();
  if (existing) {
    const completed = new Set(JSON.parse(existing.completed_cases));
    completed.add(caseId);
    const nextOrdinal = entry.ordinal + 1;
    run('UPDATE campaign_progress SET completed_cases = ?, current_ordinal = MAX(current_ordinal, ?), decisions = ?, updated_at = ? WHERE user_id = ? AND campaign_id = ?',
      [JSON.stringify([...completed]), nextOrdinal, existing.decisions, ts, req.user.id, campaignId]);
  } else {
    run('INSERT INTO campaign_progress (user_id, campaign_id, current_ordinal, decisions, completed_cases, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, campaignId, entry.ordinal + 1, '[]', JSON.stringify([caseId]), ts]);
  }
  res.json({ ok: true });
}));

// Personlig statistik och prestationer (aggregerad, integritetsfokuserad).
casesRouter.get('/stats/me', authRequired, asyncHandler((req, res) => {
  const uid = req.user.id;
  const started = getOne('SELECT COUNT(*) AS n FROM investigation_sessions WHERE user_id = ?', [uid]).n;
  const solved = getOne("SELECT COUNT(*) AS n FROM investigation_sessions WHERE user_id = ? AND status = 'solved'", [uid]).n;
  const discovered = getOne('SELECT COUNT(*) AS n FROM discovered_evidence d JOIN investigation_rooms r ON r.id = d.room_id WHERE d.discovered_by = ?', [uid]).n;
  const interrogations = getOne('SELECT COUNT(*) AS n FROM interrogations WHERE user_id = ?', [uid]).n;
  const hints = getOne(
    `SELECT COUNT(*) AS n FROM session_events WHERE actor_id = ? AND type = 'hint.requested'`, [uid]).n;
  const totalScore = getOne('SELECT COALESCE(SUM(points), 0) AS n FROM score_events WHERE user_id = ?', [uid]).n;
  const byDifficulty = getAll(
    `SELECT r.difficulty, COUNT(*) AS n FROM investigation_sessions s
     JOIN investigation_rooms r ON r.id = s.room_id
     WHERE s.user_id = ? GROUP BY r.difficulty`, [uid]);
  const achievements = buildAchievements({ started, solved, discovered, interrogations, hints });
  res.json({
    stats: {
      started, solved, solveRate: started ? Math.round((solved / started) * 100) : 0,
      discovered, interrogations, hints, totalScore, byDifficulty,
    },
    achievements,
  });
}));

function buildAchievements({ started, solved, discovered, interrogations, hints }) {
  const defs = [
    { id: 'first_case', label: 'Första fallet', desc: 'Starta din första utredning', test: started >= 1 },
    { id: 'solved_1', label: 'Löst första gåtan', desc: 'Lämna en korrekt anklagelse', test: solved >= 1 },
    { id: 'solved_5', label: 'Veteranutredare', desc: 'Lös fem fall', test: solved >= 5 },
    { id: 'evidence_25', label: 'Spårsökare', desc: 'Säkra 25 bevis', test: discovered >= 25 },
    { id: 'interrogator', label: 'Förhörsledare', desc: 'Genomför 10 förhör', test: interrogations >= 10 },
    { id: 'self_sufficient', label: 'Egen näsa', desc: 'Lös ett fall utan ledtrådar', test: solved >= 1 && hints === 0 },
  ];
  return defs.map(({ test, ...rest }) => ({ ...rest, unlocked: test }));
}
