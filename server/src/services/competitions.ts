import type { Db } from '../db.js';
import { audit } from '../db.js';
import { badRequest, conflict, forbidden, notFound, unauthorized } from '../lib/errors.js';
import { competitionClass, competitionClassLabel, progressBps, scoreCenti } from '../lib/money.js';
import { nowIso, nowMs, toIso, DAY_MS } from '../lib/time.js';
import { topBadgeFor } from './achievements.js';
import { uuid } from '../lib/ids.js';

export interface CompetitionRow {
  id: string;
  name: string;
  description: string;
  duration_days: number;
  visibility: 'public' | 'private';
  group_id: string | null;
  status: 'upcoming' | 'active' | 'completed' | 'cancelled';
  starts_at: string;
  ends_at: string;
  created_by: string | null;
  created_at: string;
  finalised_at: string | null;
  scoring_note: string;
}

export interface ParticipantRow {
  id: string;
  competition_id: string;
  user_id: string;
  goal_id: string;
  starting_balance_ore: number;
  locked_target_ore: number;
  class_code: string;
  snapshot_frozen_at: string | null;
  joined_at: string;
  withdrawn_at: string | null;
  final_score_centi: number | null;
  final_rank: number | null;
}

export async function getCompetition(db: Db, id: string): Promise<CompetitionRow>{
  const row = await db.prepare('SELECT * FROM competitions WHERE id = ?').get(id) as CompetitionRow | undefined;
  if (!row) throw notFound('Tävlingen hittades inte.');
  return row;
}

export async function getParticipant(db: Db, competitionId: string, userId: string): Promise<ParticipantRow | undefined>{
  return await db
    .prepare('SELECT * FROM competition_participants WHERE competition_id = ? AND user_id = ?')
    .get(competitionId, userId) as ParticipantRow | undefined;
}

/* ------------------------------------------------------------------ *
 * Lifecycle
 * ------------------------------------------------------------------ */

export async function createCompetition(
  db: Db,
  input: {
    name: string;
    description?: string;
    durationDays: 7 | 30;
    visibility: 'public' | 'private';
    groupId?: string | null;
    startsAt: string;
    createdBy?: string | null;
  },
): Promise<CompetitionRow>{
  const id = uuid();
  const startsAtMs = Date.parse(input.startsAt);
  const endsAt = toIso(startsAtMs + input.durationDays * DAY_MS);
  await db.prepare(
    `INSERT INTO competitions (id, name, description, duration_days, visibility, group_id, status, starts_at, ends_at, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'upcoming', ?, ?, ?, ?)`,
  ).run(
    id,
    input.name,
    input.description ?? '',
    input.durationDays,
    input.visibility,
    input.groupId ?? null,
    new Date(startsAtMs).toISOString(),
    endsAt,
    input.createdBy ?? null,
    nowIso(),
  );
  return await getCompetition(db, id);
}

/** Freezes the starting snapshot of every eligible participant. Server time only. */
async function freezeSnapshots(db: Db, competitionId: string): Promise<void>{
  const now = nowIso();
  const participants = await db
    .prepare(
      `SELECT * FROM competition_participants
       WHERE competition_id = ? AND snapshot_frozen_at IS NULL AND withdrawn_at IS NULL`,
    )
    .all(competitionId) as ParticipantRow[];
  const goalStmt = db.prepare('SELECT id, owner_id, target_amount_ore, balance_ore, archived_at FROM savings_goals WHERE id = ?');
  const update = db.prepare(
    `UPDATE competition_participants
     SET starting_balance_ore = ?, locked_target_ore = ?, class_code = ?, snapshot_frozen_at = ?
     WHERE id = ? AND snapshot_frozen_at IS NULL`,
  );
  const withdraw = db.prepare(
    'UPDATE competition_participants SET withdrawn_at = ? WHERE id = ? AND withdrawn_at IS NULL',
  );
  for (const participant of participants) {
    const goal = await goalStmt.get(participant.goal_id) as
      | { id: string; owner_id: string; target_amount_ore: number; balance_ore: number; archived_at: string | null }
      | undefined;
    if (!goal || goal.owner_id !== participant.user_id || goal.archived_at) {
      await withdraw.run(now, participant.id);
      continue;
    }
    const lockedTarget = participant.locked_target_ore > 0 ? participant.locked_target_ore : goal.target_amount_ore;
    await update.run(
      goal.balance_ore,
      lockedTarget,
      competitionClass(lockedTarget, goal.balance_ore),
      now,
      participant.id,
    );
  }
}

async function finaliseCompetition(db: Db, competition: CompetitionRow): Promise<void>{
  await freezeSnapshots(db, competition.id);
  const rows = await currentScores(db, competition.id);
  const ranked = await rankRows(rows);
  const update = db.prepare(
    `UPDATE competition_participants SET final_score_centi = ?, final_rank = ?
     WHERE id = ? AND final_score_centi IS NULL`,
  );
  for (const row of ranked) {
    await update.run(row.scoreCenti, row.rank, row.participantId);
  }
  await db.prepare(
    `UPDATE competitions SET status = 'completed', finalised_at = ?
     WHERE id = ? AND status = 'active' AND finalised_at IS NULL`,
  ).run(nowIso(), competition.id);
  audit(db, 'competition.finalised', null, competition.id, { participants: ranked.length });
}

/**
 * Idempotent lifecycle sweep, driven exclusively by server time:
 *  - upcoming competitions whose start time has passed are atomically activated and snapshotted,
 *  - active competitions whose end time has passed get their final scores frozen.
 */
export async function syncCompetitionLifecycle(db: Db): Promise<void>{
  const now = nowIso();
  const toStart = await db
    .prepare(`SELECT id FROM competitions WHERE status = 'upcoming' AND starts_at <= ?`)
    .all(now) as Array<{ id: string }>;
  for (const { id } of toStart) {
    await db.tx(async () => {
      await freezeSnapshots(db, id);
      await db.prepare(`UPDATE competitions SET status = 'active' WHERE id = ? AND status = 'upcoming'`).run(id);
      audit(db, 'competition.started', null, id);
    });
  }
  const toEnd = await db
    .prepare(`SELECT * FROM competitions WHERE status = 'active' AND ends_at <= ?`)
    .all(now) as CompetitionRow[];
  for (const competition of toEnd) {
    await db.tx(async () => await finaliseCompetition(db, competition));
  }
}

/** Keeps 7- and 30-day public competitions available without any external scheduler. */
export async function ensurePublicCompetitions(db: Db): Promise<void>{
  const now = nowMs();
  for (const durationDays of [7, 30] as const) {
    const active = await db
      .prepare(
        `SELECT COUNT(*) AS count FROM competitions
         WHERE visibility = 'public' AND duration_days = ? AND status IN ('upcoming', 'active')
           AND ends_at > ?`,
      )
      .get(durationDays, toIso(now)) as { count: number };
    if (active.count > 0) continue;
    const label = durationDays === 7 ? '7-dagars spartävling' : '30-dagars spartävling';
    await createCompetition(db, {
      name: label,
      description:
        durationDays === 7
          ? 'En vecka av små steg. Stoppa in lite extra och klättra på topplistan.'
          : 'En månad med fokus. Bygg vanan som håller i sig.',
      durationDays,
      visibility: 'public',
      startsAt: toIso(now),
    });
  }
}

/* ------------------------------------------------------------------ *
 * Participation
 * ------------------------------------------------------------------ */

export interface JoinInput {
  goalId: string;
}

export async function joinCompetition(
  db: Db,
  userId: string,
  competitionId: string,
  input: JoinInput,
): Promise<{ competition: CompetitionRow; participant: ParticipantRow; joinedActive: boolean }> {
  return await db.tx(async () => {
    const competition = await getCompetition(db, competitionId);
    if (competition.status === 'completed' || competition.status === 'cancelled') {
      throw conflict('Tävlingen är avslutad och går inte att gå med i.');
    }
    const now = nowIso();
    const endsAtMs = Date.parse(competition.ends_at);
    if (endsAtMs <= Date.parse(now)) throw conflict('Tävlingen har redan avslutats.');

    if (competition.visibility === 'public') {
      const profile = await db
        .prepare('SELECT public_competition_consent FROM profiles WHERE user_id = ?')
        .get(userId) as { public_competition_consent: number } | undefined;
      if (!profile) throw unauthorized();
      if (profile.public_competition_consent !== 1) {
        throw forbidden('Du behöver först godkänna deltagande i offentliga tävlingar under Profil och integritet.');
      }
    } else {
      if (!competition.group_id) throw badRequest('Privat tävling saknar grupp.');
      const member = await db
        .prepare('SELECT 1 AS ok FROM group_members WHERE group_id = ? AND user_id = ?')
        .get(competition.group_id, userId) as { ok: number } | undefined;
      // 404 rather than 403 so a private competition is not even discoverable by outsiders.
      if (!member) throw notFound('Tävlingen hittades inte.');
    }

    const goal = await db
      .prepare('SELECT * FROM savings_goals WHERE id = ? AND owner_id = ?')
      .get(input.goalId, userId) as
      | { id: string; target_amount_ore: number; balance_ore: number; archived_at: string | null }
      | undefined;
    if (!goal) throw notFound('Sparmålet hittades inte.');
    if (goal.archived_at) throw conflict('Ett arkiverat sparmål kan inte användas i en tävling.');

    const existing = await getParticipant(db, competitionId, userId);
    if (existing) throw conflict('Du deltar redan i den här tävlingen.');

    const id = uuid();
    // For a competition that has already started the snapshot is taken right now; for an upcoming
    // competition snapshot_frozen_at stays NULL until the server starts it.
    const started = competition.status === 'active' && Date.parse(competition.starts_at) <= Date.parse(now);
    try {
      await db.prepare(
        `INSERT INTO competition_participants
          (id, competition_id, user_id, goal_id, starting_balance_ore, locked_target_ore, class_code,
           snapshot_frozen_at, joined_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        competitionId,
        userId,
        goal.id,
        started ? goal.balance_ore : 0,
        goal.target_amount_ore,
        started ? competitionClass(goal.target_amount_ore, goal.balance_ore) : '',
        started ? now : null,
        now,
      );
    } catch (error) {
      if (String(error).includes('UNIQUE')) throw conflict('Du deltar redan i den här tävlingen.');
      throw error;
    }
    audit(db, 'competition.joined', userId, competitionId, { goalId: goal.id });
    return {
      competition,
      participant: await db
        .prepare('SELECT * FROM competition_participants WHERE id = ?')
        .get(id) as ParticipantRow,
      joinedActive: started,
    };
  });
}

export async function withdrawFromCompetition(db: Db, userId: string, competitionId: string): Promise<void>{
  await db.tx(async () => {
    const competition = await getCompetition(db, competitionId);
    const participant = await getParticipant(db, competitionId, userId);
    if (!participant) throw notFound('Du deltar inte i den här tävlingen.');
    if (participant.withdrawn_at) throw conflict('Du har redan lämnat tävlingen.');
    if (competition.status === 'completed' || competition.finalised_at) {
      throw conflict('Tävlingen är avslutad. Resultatet är låst.');
    }
    await db.prepare('UPDATE competition_participants SET withdrawn_at = ? WHERE id = ?').run(nowIso(), participant.id);
    audit(db, 'competition.withdrawn', userId, competitionId);
  });
}

/* ------------------------------------------------------------------ *
 * Scoring & leaderboards
 * ------------------------------------------------------------------ */

interface ScoreRow {
  participantId: string;
  userId: string;
  alias: string;
  scoreCenti: number;
  classCode: string;
  frozen: number;
}

interface RankedRow extends ScoreRow {
  rank: number;
}

async function currentScores(db: Db, competitionId: string): Promise<ScoreRow[]>{
  const rows = await db
    .prepare(
      `SELECT p.id AS "participantId", p.user_id AS "userId", p.starting_balance_ore AS "startingBalance",
              p.locked_target_ore AS "lockedTarget", p.class_code AS "classCode",
              p.snapshot_frozen_at AS "frozenAt", p.final_score_centi AS "finalScore",
              g.balance_ore AS "currentBalance", pr.alias AS alias
       FROM competition_participants p
       JOIN savings_goals g ON g.id = p.goal_id AND g.owner_id = p.user_id
       JOIN profiles pr ON pr.user_id = p.user_id
       JOIN users u ON u.id = p.user_id
       WHERE p.competition_id = ? AND p.withdrawn_at IS NULL AND p.snapshot_frozen_at IS NOT NULL`,
    )
    .all(competitionId) as Array<{
    participantId: string;
    userId: string;
    startingBalance: number;
    lockedTarget: number;
    classCode: string;
    frozenAt: string | null;
    finalScore: number | null;
    currentBalance: number;
    alias: string;
  }>;

  return rows.map((row) => ({
    participantId: row.participantId,
    userId: row.userId,
    alias: row.alias,
    classCode: row.classCode,
    // A finalised score is authoritative once frozen; otherwise compute live from the ledger balance.
    scoreCenti:
      row.finalScore !== null
        ? row.finalScore
        : scoreCenti(row.currentBalance, row.startingBalance, row.lockedTarget),
    frozen: row.finalScore !== null ? 1 : 0,
  }));
}

/** Competition ranking: tied scores share a rank, the next rank skips (1,2,2,4). */
async function rankRows(rows: ScoreRow[]): Promise<RankedRow[]>{
  const sorted = [...rows].sort((a, b) => {
    if (b.scoreCenti !== a.scoreCenti) return b.scoreCenti - a.scoreCenti;
    return a.alias.localeCompare(b.alias, 'sv');
  });
  let lastScore: number | null = null;
  let lastRank = 0;
  return sorted.map((row, index) => {
    const rank = lastScore !== null && row.scoreCenti === lastScore ? lastRank : index + 1;
    lastScore = row.scoreCenti;
    lastRank = rank;
    return { ...row, rank };
  });
}

export interface LeaderboardEntry {
  rank: number | null;
  alias: string;
  score: number;
  scoreCenti: number;
  classCode: string;
  badge: string | null;
  isYou: boolean;
}

/**
 * Dedicated read model: only alias, rank, score, class and an explicitly approved badge ever leave
 * the server. Balances, targets, goals and transactions are never selected into this projection.
 */
export async function leaderboard(
  db: Db,
  competition: CompetitionRow,
  viewerUserId: string | null,
): Promise<{
  competition: CompetitionRow;
  entries: LeaderboardEntry[];
  classLabel: string | null;
  startsInSeconds: number | null;
  endsInSeconds: number | null;
  requiresConsent: boolean;
}> {
  const frozenScores = competition.status === 'completed';
  let entries: LeaderboardEntry[];
  if (frozenScores) {
    const rows = await db
      .prepare(
        `SELECT p.final_rank AS rank, pr.alias AS alias, p.final_score_centi AS "scoreCenti",
                p.class_code AS "classCode", p.user_id AS "userId"
         FROM competition_participants p
         JOIN profiles pr ON pr.user_id = p.user_id
         JOIN users u ON u.id = p.user_id
         WHERE p.competition_id = ? AND p.final_rank IS NOT NULL
         ORDER BY p.final_rank ASC, pr.alias ASC`,
      )
      .all(competition.id) as Array<{
      rank: number | null;
      alias: string;
      scoreCenti: number;
      classCode: string;
      userId: string;
    }>;
    entries = await Promise.all(
      rows.map(async (row) => ({
        rank: row.rank,
        alias: row.alias,
        score: row.scoreCenti / 100,
        scoreCenti: row.scoreCenti,
        classCode: row.classCode,
        badge: await topBadgeFor(db, row.userId),
        isYou: viewerUserId !== null && row.userId === viewerUserId,
      })),
    );
  } else {
    const ranked = await rankRows(await currentScores(db, competition.id));
    entries = await Promise.all(
      ranked.map(async (row) => ({
        rank: row.rank,
        alias: row.alias,
        score: row.scoreCenti / 100,
        scoreCenti: row.scoreCenti,
        classCode: row.classCode,
        badge: await topBadgeFor(db, row.userId),
        isYou: viewerUserId !== null && row.userId === viewerUserId,
      })),
    );
  }
  const now = nowMs();
  return {
    competition,
    entries,
    classLabel: entries.length ? competitionClassLabel(entries[0]!.classCode) : null,
    startsInSeconds: Math.max(0, Math.round((Date.parse(competition.starts_at) - now) / 1000)),
    endsInSeconds: Math.max(0, Math.round((Date.parse(competition.ends_at) - now) / 1000)),
    requiresConsent: competition.visibility === 'public',
  };
}

/* ------------------------------------------------------------------ *
 * Discovery
 * ------------------------------------------------------------------ */

export interface CompetitionSummary {
  id: string;
  name: string;
  description: string;
  durationDays: number;
  visibility: 'public' | 'private';
  status: CompetitionRow['status'];
  startsAt: string;
  endsAt: string;
  participantCount: number;
  joined: boolean;
  participantClassCode: string | null;
  groupId: string | null;
  finalisedAt: string | null;
  myRank: number | null;
  myScore: number | null;
}

async function toSummary(
  db: Db,
  competition: CompetitionRow,
  userId: string | null,
): Promise<CompetitionSummary>{
  const count = await db
    .prepare(
      `SELECT COUNT(*) AS count FROM competition_participants
       WHERE competition_id = ? AND withdrawn_at IS NULL`,
    )
    .get(competition.id) as { count: number };
  const participant = userId ? await getParticipant(db, competition.id, userId) : undefined;
  let myRank: number | null = null;
  let myScore: number | null = null;
  if (participant && !participant.withdrawn_at && userId) {
    if (competition.status === 'completed' && participant.final_score_centi !== null) {
      myScore = participant.final_score_centi / 100;
      myRank = participant.final_rank;
    } else {
      const ranked = await rankRows(await currentScores(db, competition.id));
      const mine = ranked.find((row) => row.userId === userId);
      if (mine) {
        myScore = mine.scoreCenti / 100;
        myRank = mine.rank;
      }
    }
  }
  return {
    id: competition.id,
    name: competition.name,
    description: competition.description,
    durationDays: competition.duration_days,
    visibility: competition.visibility,
    status: competition.status,
    startsAt: competition.starts_at,
    endsAt: competition.ends_at,
    participantCount: count.count,
    joined: Boolean(participant && !participant.withdrawn_at),
    participantClassCode: participant && !participant.withdrawn_at ? participant.class_code || null : null,
    groupId: competition.group_id,
    finalisedAt: competition.finalised_at,
    myRank,
    myScore,
  };
}

export async function discoverCompetitions(db: Db, userId: string | null): Promise<{
  public: CompetitionSummary[];
  mine: CompetitionSummary[];
  groups: Array<{ groupId: string; groupName: string; competitions: CompetitionSummary[] }>;
}> {
  const now = nowIso();
  const publicRows = await db
    .prepare(
      `SELECT * FROM competitions
       WHERE visibility = 'public' AND status IN ('upcoming', 'active', 'completed')
       ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'upcoming' THEN 1 ELSE 2 END, starts_at ASC
       LIMIT 40`,
    )
    .all() as CompetitionRow[];

  const publicList = await Promise.all(
    publicRows
      .filter((row) => row.status !== 'completed' || Date.parse(row.ends_at) > Date.parse(now) - 14 * DAY_MS)
      .map((row) => toSummary(db, row, userId)),
  );

  if (!userId) return { public: publicList, mine: [], groups: [] };

  const mineRows = await db
    .prepare(
      `SELECT c.* FROM competitions c
       JOIN competition_participants p ON p.competition_id = c.id
       WHERE p.user_id = ? AND p.withdrawn_at IS NULL
       ORDER BY CASE c.status WHEN 'active' THEN 0 WHEN 'upcoming' THEN 1 ELSE 2 END, c.ends_at DESC
       LIMIT 40`,
    )
    .all(userId) as CompetitionRow[];

  const groupRows = await db
    .prepare(
      `SELECT g.id AS "groupId", g.name AS "groupName"
       FROM private_groups g JOIN group_members m ON m.group_id = g.id
       WHERE m.user_id = ? ORDER BY g.created_at ASC`,
    )
    .all(userId) as Array<{ groupId: string; groupName: string }>;

  const groups = await Promise.all(groupRows.map(async (group) => {
    const rows = await db
      .prepare(
        `SELECT * FROM competitions WHERE group_id = ?
         ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'upcoming' THEN 1 ELSE 2 END, ends_at DESC
         LIMIT 20`,
      )
      .all(group.groupId) as CompetitionRow[];
    return {
      groupId: group.groupId,
      groupName: group.groupName,
      competitions: await Promise.all(rows.map((row) => toSummary(db, row, userId))),
    };
  }));

  return {
    public: publicList,
    mine: await Promise.all(mineRows.map((row) => toSummary(db, row, userId))),
    groups,
  };
}

export async function canViewCompetition(db: Db, competition: CompetitionRow, userId: string | null): Promise<boolean>{
  if (competition.visibility === 'public') return true;
  if (!userId || !competition.group_id) return false;
  const member = await db
    .prepare('SELECT 1 AS ok FROM group_members WHERE group_id = ? AND user_id = ?')
    .get(competition.group_id, userId) as { ok: number } | undefined;
  return Boolean(member);
}

export async function myParticipationView(
  db: Db,
  competition: CompetitionRow,
  userId: string | null,
): Promise<{
  joined: boolean;
  withdrawn: boolean;
  goalId: string | null;
  classCode: string | null;
  classLabel: string | null;
  score: number | null;
  rank: number | null;
  startingBalanceOre: number | null;
  lockedTargetOre: number | null;
  snapshotFrozen: boolean;
  progressBps: number | null;
}> {
  if (!userId) {
    return {
      joined: false,
      withdrawn: false,
      goalId: null,
      classCode: null,
      classLabel: null,
      score: null,
      rank: null,
      startingBalanceOre: null,
      lockedTargetOre: null,
      snapshotFrozen: false,
      progressBps: null,
    };
  }
  const participant = await getParticipant(db, competition.id, userId);
  if (!participant) {
    return {
      joined: false,
      withdrawn: false,
      goalId: null,
      classCode: null,
      classLabel: null,
      score: null,
      rank: null,
      startingBalanceOre: null,
      lockedTargetOre: null,
      snapshotFrozen: false,
      progressBps: null,
    };
  }
  const goal = await db
    .prepare('SELECT balance_ore FROM savings_goals WHERE id = ? AND owner_id = ?')
    .get(participant.goal_id, userId) as { balance_ore: number } | undefined;
  const frozen = participant.snapshot_frozen_at !== null;
  const score =
    participant.final_score_centi !== null
      ? participant.final_score_centi / 100
      : frozen && goal
        ? scoreCenti(goal.balance_ore, participant.starting_balance_ore, participant.locked_target_ore) / 100
        : null;
  const leaderboardRows = competition.status === 'completed'
    ? null
    : await rankRows(await currentScores(db, competition.id));
  const mine = leaderboardRows?.find((row) => row.userId === userId);
  return {
    joined: !participant.withdrawn_at,
    withdrawn: participant.withdrawn_at !== null,
    goalId: participant.goal_id,
    classCode: participant.class_code || null,
    classLabel: participant.class_code ? competitionClassLabel(participant.class_code) : null,
    score,
    rank: participant.final_rank ?? mine?.rank ?? null,
    startingBalanceOre: frozen ? participant.starting_balance_ore : null,
    lockedTargetOre: frozen ? participant.locked_target_ore : null,
    snapshotFrozen: frozen,
    progressBps:
      frozen && goal ? progressBps(goal.balance_ore, participant.locked_target_ore) : null,
  };
}
