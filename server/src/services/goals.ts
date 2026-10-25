import type { Db } from '../db.js';
import { immediate } from '../db.js';
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

export function getOwnedGoal(db: Db, userId: string, goalId: string): GoalRow {
  const row = db
    .prepare('SELECT * FROM savings_goals WHERE id = ? AND owner_id = ?')
    .get(goalId, userId) as GoalRow | undefined;
  // 404 (not 403) so that goal IDs of other users are not enumerable.
  if (!row) throw notFound('Sparmålet hittades inte.');
  return row;
}

export function competitionLockForGoal(db: Db, goalId: string): { count: number; locked: boolean } {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS count FROM competition_participants p
       JOIN competitions c ON c.id = p.competition_id
       WHERE p.goal_id = ? AND p.withdrawn_at IS NULL AND c.status IN ('upcoming', 'active')`,
    )
    .get(goalId) as { count: number };
  return { count: row.count, locked: row.count > 0 };
}

export function goalMilestones(db: Db, goalId: string): GoalView['milestones'] {
  const bps = progressBpsCached(db, goalId);
  const rows = db
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

function progressBpsCached(db: Db, goalId: string): number {
  const row = db.prepare('SELECT balance_ore, target_amount_ore FROM savings_goals WHERE id = ?').get(goalId) as
    | { balance_ore: number; target_amount_ore: number }
    | undefined;
  if (!row) return 0;
  return progressBps(row.balance_ore, row.target_amount_ore);
}

export function toGoalView(db: Db, goal: GoalRow): GoalView {
  const bps = progressBps(goal.balance_ore, goal.target_amount_ore);
  const lock = competitionLockForGoal(db, goal.id);
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
    milestones: goalMilestones(db, goal.id),
    lockedTarget: lock.locked,
    activeCompetitionCount: lock.count,
  };
}

export function listGoals(db: Db, userId: string, includeArchived: boolean): GoalView[] {
  const rows = db
    .prepare(
      `SELECT * FROM savings_goals
       WHERE owner_id = ? AND (? = 1 OR archived_at IS NULL)
       ORDER BY archived_at IS NOT NULL, created_at DESC, rowid DESC`,
    )
    .all(userId, includeArchived ? 1 : 0) as GoalRow[];
  return rows.map((row) => toGoalView(db, row));
}

export interface CreateGoalInput {
  name: string;
  targetAmountOre: number;
  privacy: 'private' | 'alias_visible';
}

export function createGoal(db: Db, userId: string, input: CreateGoalInput): GoalView {
  const now = nowIso();
  const id = uuid();
  db.prepare(
    `INSERT INTO savings_goals (id, owner_id, name, target_amount_ore, balance_ore, currency, privacy, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, 'SEK', ?, ?, ?)`,
  ).run(id, userId, input.name, input.targetAmountOre, input.privacy, now, now);
  return toGoalView(db, getOwnedGoal(db, userId, id));
}

export interface UpdateGoalInput {
  name?: string | undefined;
  targetAmountOre?: number | undefined;
  privacy?: 'private' | 'alias_visible' | undefined;
}

export function updateGoal(db: Db, userId: string, goalId: string, input: UpdateGoalInput): GoalView {
  return immediate(db, () => {
    const goal = getOwnedGoal(db, userId, goalId);
    if (goal.archived_at) throw conflict('Sparmålet är arkiverat. Avarkivera det först.');
    if (input.targetAmountOre !== undefined && input.targetAmountOre !== goal.target_amount_ore) {
      const lock = competitionLockForGoal(db, goalId);
      if (lock.locked) {
        throw conflict('Målbeloppet är låst medan en tävling pågår eller väntar på start.');
      }
      if (input.targetAmountOre < goal.balance_ore) {
        throw badRequest('Målbeloppet kan inte vara lägre än det redan sparade beloppet.');
      }
    }
    db.prepare(
      `UPDATE savings_goals SET name = ?, target_amount_ore = ?, privacy = ?, updated_at = ? WHERE id = ? AND owner_id = ?`,
    ).run(
      input.name ?? goal.name,
      input.targetAmountOre ?? goal.target_amount_ore,
      input.privacy ?? goal.privacy,
      nowIso(),
      goalId,
      userId,
    );
    return toGoalView(db, getOwnedGoal(db, userId, goalId));
  });
}

export function setArchived(db: Db, userId: string, goalId: string, archived: boolean): GoalView {
  return immediate(db, () => {
    const goal = getOwnedGoal(db, userId, goalId);
    if (archived) {
      const lock = competitionLockForGoal(db, goalId);
      if (lock.locked) throw conflict('Du kan inte arkivera ett mål som deltar i en pågående tävling.');
    }
    db.prepare('UPDATE savings_goals SET archived_at = ?, updated_at = ? WHERE id = ? AND owner_id = ?').run(
      archived ? nowIso() : null,
      nowIso(),
      goal.id,
      userId,
    );
    return toGoalView(db, getOwnedGoal(db, userId, goalId));
  });
}

export function deleteGoal(db: Db, userId: string, goalId: string): void {
  immediate(db, () => {
    const goal = getOwnedGoal(db, userId, goalId);
    const lock = competitionLockForGoal(db, goal.id);
    if (lock.locked) throw conflict('Du kan inte ta bort ett mål som deltar i en pågående tävling.');
    db.prepare('DELETE FROM savings_goals WHERE id = ? AND owner_id = ?').run(goal.id, userId);
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

export function recordMovement(db: Db, userId: string, goalId: string, input: MovementInput): MovementResult {
  return immediate(db, () => {
    const goal = getOwnedGoal(db, userId, goalId);
    if (goal.archived_at) throw conflict('Sparmålet är arkiverat och kan inte ta emot rörelser.');

    const delta = input.type === 'deposit' ? input.amountOre : -input.amountOre;
    const nextBalance = goal.balance_ore + delta;
    if (nextBalance < 0) throw badRequest('Uttaget är större än det sparade beloppet.');

    const now = nowIso();
    const occurredAt = input.occurredAt ?? now;
    db.prepare('UPDATE savings_goals SET balance_ore = ?, updated_at = ? WHERE id = ? AND owner_id = ?').run(
      nextBalance,
      now,
      goalId,
      userId,
    );
    const movementId = uuid();
    db.prepare(
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

    const updated = getOwnedGoal(db, userId, goalId);
    const newlyEarned = syncGoalAchievements(db, userId, updated.id, updated.balance_ore, updated.target_amount_ore);
    return {
      goal: toGoalView(db, updated),
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

export function listMovements(db: Db, userId: string, goalId: string): unknown[] {
  getOwnedGoal(db, userId, goalId);
  return db
    .prepare(
      `SELECT id, goal_id AS goalId, type, amount_ore AS amountOre, balance_after_ore AS balanceAfterOre,
              note, occurred_at AS occurredAt, created_at AS createdAt
       FROM savings_movements WHERE goal_id = ? AND owner_id = ? ORDER BY occurred_at DESC, created_at DESC`,
    )
    .all(goalId, userId);
}

export function assertGoalWritable(goal: GoalRow): void {
  if (goal.archived_at) throw forbidden('Sparmålet är arkiverat.');
}
