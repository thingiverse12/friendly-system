import type { Db } from '../db.js';
import { badRequest, conflict, notFound, forbidden } from '../lib/errors.js';
import { uuid } from '../lib/ids.js';
import { nowIso } from '../lib/time.js';
import { progressBps } from '../lib/money.js';
import { syncGoalAchievements, type EarnedAchievement } from './achievements.js';

export interface GoalRow {
  id: string;
  owner_id: string;
  name: string;
  target_amount_ore: number;
  balance_ore: number;
  currency: string;
  privacy: 'private' | 'alias_visible';
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface GoalView {
  id: string;
  name: string;
  targetAmountOre: number;
  balanceOre: number;
  currency: string;
  privacy: 'private' | 'alias_visible';
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  progressBps: number;
  progressPercentage: number;
  remainingOre: number;
  archived: boolean;
  milestones: Array<{ code: string; name: string; badge: string; thresholdBps: number; reached: boolean }>;
  lockedTarget: boolean;
  activeCompetitionCount: number;
}

export async function getOwnedGoal(db: Db, userId: string, goalId: string): Promise<GoalRow>{
  const row = await db
    .prepare('SELECT * FROM savings_goals WHERE id = ? AND owner_id = ?')
    .get(goalId, userId) as GoalRow | undefined;
  // 404 (not 403) so that goal IDs of other users are not enumerable.
  if (!row) throw notFound('Sparmålet hittades inte.');
  return row;
}

export async function competitionLockForGoal(db: Db, goalId: string): Promise<{ count: number; locked: boolean }> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS count FROM competition_participants p
       JOIN competitions c ON c.id = p.competition_id
       WHERE p.goal_id = ? AND p.withdrawn_at IS NULL AND c.status IN ('upcoming', 'active')`,
    )
    .get(goalId) as { count: number };
  return { count: row.count, locked: row.count > 0 };
}

export async function goalMilestones(db: Db, goalId: string): Promise<GoalView['milestones']>{
  const bps = await progressBpsCached(db, goalId);
  const rows = await db
    .prepare('SELECT code, name, badge, milestone_bps FROM achievements ORDER BY sort_order')
    .all() as Array<{ code: string; name: string; badge: string; milestone_bps: number }>;
  return rows.map((row) => ({
    code: row.code,
    name: row.name,
    badge: row.badge,
    thresholdBps: row.milestone_bps,
    reached: bps >= row.milestone_bps,
  }));
}

async function progressBpsCached(db: Db, goalId: string): Promise<number>{
  const row = await db.prepare('SELECT balance_ore, target_amount_ore FROM savings_goals WHERE id = ?').get(goalId) as
    | { balance_ore: number; target_amount_ore: number }
    | undefined;
  if (!row) return 0;
  return progressBps(row.balance_ore, row.target_amount_ore);
}

export async function toGoalView(db: Db, goal: GoalRow): Promise<GoalView>{
  const bps = progressBps(goal.balance_ore, goal.target_amount_ore);
  const lock = await competitionLockForGoal(db, goal.id);
  return {
    id: goal.id,
    name: goal.name,
    targetAmountOre: goal.target_amount_ore,
    balanceOre: goal.balance_ore,
    currency: goal.currency,
    privacy: goal.privacy,
    createdAt: goal.created_at,
    updatedAt: goal.updated_at,
    archivedAt: goal.archived_at,
    progressBps: bps,
    progressPercentage: Math.round(bps) / 100,
    remainingOre: Math.max(0, goal.target_amount_ore - goal.balance_ore),
    archived: goal.archived_at !== null,
    milestones: await goalMilestones(db, goal.id),
    lockedTarget: lock.locked,
    activeCompetitionCount: lock.count,
  };
}

export async function listGoals(db: Db, userId: string, includeArchived: boolean): Promise<GoalView[]>{
  const rows = await db
    .prepare(
      `SELECT * FROM savings_goals
       WHERE owner_id = ? AND (? = 1 OR archived_at IS NULL)
       ORDER BY archived_at IS NOT NULL, created_at DESC, seq DESC`,
    )
    .all(userId, includeArchived ? 1 : 0) as GoalRow[];
  return Promise.all(rows.map((row) => toGoalView(db, row)));
}

export interface CreateGoalInput {
  name: string;
  targetAmountOre: number;
  privacy: 'private' | 'alias_visible';
}

export async function createGoal(db: Db, userId: string, input: CreateGoalInput): Promise<GoalView>{
  const now = nowIso();
  const id = uuid();
  await db.prepare(
    `INSERT INTO savings_goals (id, owner_id, name, target_amount_ore, balance_ore, currency, privacy, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, 'SEK', ?, ?, ?)`,
  ).run(id, userId, input.name, input.targetAmountOre, input.privacy, now, now);
  return await toGoalView(db, await getOwnedGoal(db, userId, id));
}

export interface UpdateGoalInput {
  name?: string | undefined;
  targetAmountOre?: number | undefined;
  privacy?: 'private' | 'alias_visible' | undefined;
}

export async function updateGoal(db: Db, userId: string, goalId: string, input: UpdateGoalInput): Promise<GoalView>{
  return await db.tx(async () => {
    const goal = await getOwnedGoal(db, userId, goalId);
    if (goal.archived_at) throw conflict('Sparmålet är arkiverat. Avarkivera det först.');
    if (input.targetAmountOre !== undefined && input.targetAmountOre !== goal.target_amount_ore) {
      const lock = await competitionLockForGoal(db, goalId);
      if (lock.locked) {
        throw conflict('Målbeloppet är låst medan en tävling pågår eller väntar på start.');
      }
      if (input.targetAmountOre < goal.balance_ore) {
        throw badRequest('Målbeloppet kan inte vara lägre än det redan sparade beloppet.');
      }
    }
    await db.prepare(
      `UPDATE savings_goals SET name = ?, target_amount_ore = ?, privacy = ?, updated_at = ? WHERE id = ? AND owner_id = ?`,
    ).run(
      input.name ?? goal.name,
      input.targetAmountOre ?? goal.target_amount_ore,
      input.privacy ?? goal.privacy,
      nowIso(),
      goalId,
      userId,
    );
    return await toGoalView(db, await getOwnedGoal(db, userId, goalId));
  });
}

export async function setArchived(db: Db, userId: string, goalId: string, archived: boolean): Promise<GoalView>{
  return await db.tx(async () => {
    const goal = await getOwnedGoal(db, userId, goalId);
    if (archived) {
      const lock = await competitionLockForGoal(db, goalId);
      if (lock.locked) throw conflict('Du kan inte arkivera ett mål som deltar i en pågående tävling.');
    }
    await db.prepare('UPDATE savings_goals SET archived_at = ?, updated_at = ? WHERE id = ? AND owner_id = ?').run(
      archived ? nowIso() : null,
      nowIso(),
      goal.id,
      userId,
    );
    return await toGoalView(db, await getOwnedGoal(db, userId, goalId));
  });
}

export async function deleteGoal(db: Db, userId: string, goalId: string): Promise<void>{
  await db.tx(async () => {
    const goal = await getOwnedGoal(db, userId, goalId);
    const lock = await competitionLockForGoal(db, goal.id);
    if (lock.locked) throw conflict('Du kan inte ta bort ett mål som deltar i en pågående tävling.');
    await db.prepare('DELETE FROM savings_goals WHERE id = ? AND owner_id = ?').run(goal.id, userId);
  });
}

export type MovementType = 'deposit' | 'withdrawal';

export interface MovementInput {
  type: MovementType;
  amountOre: number;
  note?: string | null;
  occurredAt?: string | undefined;
}

export interface MovementResult {
  goal: GoalView;
  movement: {
    id: string;
    type: MovementType;
    amountOre: number;
    balanceAfterOre: number;
    note: string | null;
    occurredAt: string;
    createdAt: string;
  };
  newlyEarned: EarnedAchievement[];
}

export async function recordMovement(db: Db, userId: string, goalId: string, input: MovementInput): Promise<MovementResult>{
  return await db.tx(async () => {
    const goal = await getOwnedGoal(db, userId, goalId);
    if (goal.archived_at) throw conflict('Sparmålet är arkiverat och kan inte ta emot rörelser.');

    const delta = input.type === 'deposit' ? input.amountOre : -input.amountOre;
    const nextBalance = goal.balance_ore + delta;
    if (nextBalance < 0) throw badRequest('Uttaget är större än det sparade beloppet.');

    const now = nowIso();
    const occurredAt = input.occurredAt ?? now;
    await db.prepare('UPDATE savings_goals SET balance_ore = ?, updated_at = ? WHERE id = ? AND owner_id = ?').run(
      nextBalance,
      now,
      goalId,
      userId,
    );
    const movementId = uuid();
    await db.prepare(
      `INSERT INTO savings_movements (id, owner_id, goal_id, type, amount_ore, balance_after_ore, note, occurred_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      movementId,
      userId,
      goalId,
      input.type,
      input.amountOre,
      nextBalance,
      input.note ?? null,
      occurredAt,
      now,
    );

    const updated = await getOwnedGoal(db, userId, goalId);
    const newlyEarned = await syncGoalAchievements(db, userId, updated.id, updated.balance_ore, updated.target_amount_ore);
    return {
      goal: await toGoalView(db, updated),
      movement: {
        id: movementId,
        type: input.type,
        amountOre: input.amountOre,
        balanceAfterOre: nextBalance,
        note: input.note ?? null,
        occurredAt,
        createdAt: now,
      },
      newlyEarned,
    };
  });
}

export async function listMovements(db: Db, userId: string, goalId: string): Promise<unknown[]>{
  await getOwnedGoal(db, userId, goalId);
  return await db
    .prepare(
      `SELECT id, goal_id AS "goalId", type, amount_ore AS "amountOre", balance_after_ore AS "balanceAfterOre",
              note, occurred_at AS "occurredAt", created_at AS "createdAt"
       FROM savings_movements WHERE goal_id = ? AND owner_id = ? ORDER BY occurred_at DESC, seq DESC`,
    )
    .all(goalId, userId);
}

export async function assertGoalWritable(goal: GoalRow): Promise<void>{
  if (goal.archived_at) throw forbidden('Sparmålet är arkiverat.');
}
