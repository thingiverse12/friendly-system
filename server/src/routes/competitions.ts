import { Router } from 'express';
import { z } from 'zod';
import type { Db } from '../db.js';
import { currentUserId, rateLimit, requireAuth, param } from '../lib/http.js';
import { forbidden, notFound } from '../lib/errors.js';
import { parseBody, RATE_LIMITS } from '../lib/validation.js';
import {
  canViewCompetition,
  discoverCompetitions,
  ensurePublicCompetitions,
  joinCompetition,
  leaderboard,
  myParticipationView,
  syncCompetitionLifecycle,
  withdrawFromCompetition,
} from '../services/competitions.js';
import { getCompetition } from '../services/competitions.js';
import { competitionClassLabel } from '../lib/money.js';

const joinSchema = z.object({ goalId: z.uuid('Välj ett sparmål.') });

export function competitionRoutes(db: Db): Router {
  const router = Router();

  /** Public discovery is readable, but never exposes other users' finances. */
  router.get('/', (req, res) => {
    syncCompetitionLifecycle(db);
    ensurePublicCompetitions(db);
    const userId = res.locals.userId;
    res.json(discoverCompetitions(db, userId));
  });

  router.get('/:competitionId', requireAuth, (req, res) => {
    syncCompetitionLifecycle(db);
    const userId = currentUserId(res);
    const competition = getCompetition(db, param(req, 'competitionId'));
    if (!canViewCompetition(db, competition, userId)) {
      throw notFound('Tävlingen hittades inte.');
    }
    const participantCount = (
      db
        .prepare(
          'SELECT COUNT(*) AS count FROM competition_participants WHERE competition_id = ? AND withdrawn_at IS NULL',
        )
        .get(competition.id) as { count: number }
    ).count;
    res.json({
      competition: {
        id: competition.id,
        participantCount,
        name: competition.name,
        description: competition.description,
        durationDays: competition.duration_days,
        visibility: competition.visibility,
        status: competition.status,
        startsAt: competition.starts_at,
        endsAt: competition.ends_at,
        finalisedAt: competition.finalised_at,
        scoringNote: competition.scoring_note,
        scoringFormula: 'score = 100 × (aktuellt saldo − startsaldo) / låst målbelopp',
      },
      myParticipation: myParticipationView(db, competition, userId),
      leaderboard: leaderboard(db, competition, userId),
      classExplanation:
        'Tävlingsklasser grupperar deltagare efter målbelopp och startandel för att göra resultaten mer jämförbara. De garanterar inte identiska ekonomiska förutsättningar.',
    });
  });

  router.get('/:competitionId/leaderboard', requireAuth, (req, res) => {
    syncCompetitionLifecycle(db);
    const userId = currentUserId(res);
    const competition = getCompetition(db, param(req, 'competitionId'));
    if (!canViewCompetition(db, competition, userId)) {
      throw notFound('Tävlingen hittades inte.');
    }
    const board = leaderboard(db, competition, userId);
    const mine = myParticipationView(db, competition, userId);
    res.json({
      competitionId: competition.id,
      status: competition.status,
      endsAt: competition.ends_at,
      startsAt: competition.starts_at,
      finalisedAt: competition.finalised_at,
      scoringNote: competition.scoring_note,
      entries: board.entries,
      classLabel: board.classLabel,
      classExplanation:
        'Klasserna jämför målbelopp och startandel. De förbättrar jämförbarheten men garanterar inte identiska förutsättningar.',
      // Only the viewer's own rank/score/class is returned - never balances or targets.
      viewer: {
        joined: mine.joined,
        withdrawn: mine.withdrawn,
        score: mine.score,
        rank: mine.rank,
        classCode: mine.classCode,
        classLabel: mine.classLabel,
      },
      classes: [...new Set(board.entries.map((entry) => entry.classCode))].map((code) => ({
        code,
        label: competitionClassLabel(code),
      })),
    });
  });

  router.post(
    '/:competitionId/join',
    requireAuth,
    rateLimit(db, 'competition-join', RATE_LIMITS.competitionJoin, (req, res) => res.locals.userId ?? ''),
    (req, res) => {
      syncCompetitionLifecycle(db);
      const userId = currentUserId(res);
      const body = parseBody(joinSchema, req.body);
      const result = joinCompetition(db, userId, param(req, 'competitionId'), { goalId: body.goalId });
      res.status(201).json({
        ok: true,
        competitionId: result.competition.id,
        joinedActive: result.joinedActive,
        participant: {
          classCode: result.participant.class_code || null,
          classLabel: result.participant.class_code ? competitionClassLabel(result.participant.class_code) : null,
          startingBalanceOre: result.participant.snapshot_frozen_at
            ? result.participant.starting_balance_ore
            : null,
          lockedTargetOre: result.participant.snapshot_frozen_at ? result.participant.locked_target_ore : null,
        },
      });
    },
  );

  router.post('/:competitionId/withdraw', requireAuth, (req, res) => {
    syncCompetitionLifecycle(db);
    const userId = currentUserId(res);
    withdrawFromCompetition(db, userId, param(req, 'competitionId'));
    res.json({ ok: true });
  });

  /** Explicitly rejected: scores are derived on the server and can never be submitted. */
  router.post('/:competitionId/score', requireAuth, () => {
    throw forbidden('Poäng beräknas alltid på servern och kan inte skickas in av klienten.');
  });

  return router;
}
