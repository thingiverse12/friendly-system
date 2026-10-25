import type { Db } from '../db.js';
import { listGoals, type GoalView } from './goals.js';
import { achievementCatalog, type LevelInfo } from './achievements.js';
import { monthlySummary, type MonthlySummary } from './transactions.js';
import { nowIso } from '../lib/time.js';

export interface DashboardData {
  totals: {
    savedOre: number;
    targetOre: number;
    progressBps: number;
    activeGoals: number;
    transactionsThisMonth: number;
  };
  month: MonthlySummary;
  goals: GoalView[];
  nextMilestone: {
    code: string;
    name: string;
    badge: string;
    thresholdBps: number;
    currentBps: number;
    remainingOre: number;
    goalId: string;
    goalName: string;
  } | null;
  level: LevelInfo;
  achievements: { earned: number; total: number };
  competitions: { active: number; upcoming: number; joined: number };
  recentTransactions: Array<{
    id: string;
    type: 'income' | 'expense';
    amountOre: number;
    category: string;
    occurredAt: string;
    goalName: string | null;
  }>;
  serverTime: string;
}

export function dashboard(db: Db, userId: string): DashboardData {
  const goals = listGoals(db, userId, false);
  const active = goals.filter((goal) => !goal.archived);
  const savedOre = active.reduce((sum, goal) => sum + goal.balanceOre, 0);
  const targetOre = active.reduce((sum, goal) => sum + goal.targetAmountOre, 0);
  const progressBps = targetOre > 0 ? Math.floor((savedOre * 10000) / targetOre) : 0;

  const now = new Date(nowIso());
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
  const month = monthlySummary(db, userId, monthStart, monthEnd);

  let nextMilestone: DashboardData['nextMilestone'] = null;
  for (const goal of active) {
    if (goal.progressBps >= 10000) continue;
    const candidate = goal.milestones.find((milestone) => !milestone.reached);
    if (!candidate) continue;
    if (!nextMilestone || candidate.thresholdBps - goal.progressBps < nextMilestone.thresholdBps - nextMilestone.currentBps) {
      nextMilestone = {
        code: candidate.code,
        name: candidate.name,
        badge: candidate.badge,
        thresholdBps: candidate.thresholdBps,
        currentBps: goal.progressBps,
        remainingOre: Math.ceil(
          ((candidate.thresholdBps - goal.progressBps) / 10000) * goal.targetAmountOre,
        ),
        goalId: goal.id,
        goalName: goal.name,
      };
    }
  }

  const achievementInfo = achievementCatalog(db, userId);
  const competitions = db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM competitions WHERE status = 'active') AS active,
         (SELECT COUNT(*) FROM competitions WHERE status = 'upcoming') AS upcoming,
         (SELECT COUNT(*) FROM competition_participants
          WHERE user_id = ? AND withdrawn_at IS NULL) AS joined`,
    )
    .get(userId) as { active: number; upcoming: number; joined: number };

  const recentTransactions = db
    .prepare(
      `SELECT t.id, t.type, t.amount_ore AS amountOre, t.category, t.occurred_at AS occurredAt, g.name AS goalName
       FROM transactions t LEFT JOIN savings_goals g ON g.id = t.goal_id AND g.owner_id = t.owner_id
       WHERE t.owner_id = ? ORDER BY t.occurred_at DESC, t.created_at DESC LIMIT 5`,
    )
    .all(userId) as DashboardData['recentTransactions'];

  const transactionCount = db
    .prepare('SELECT COUNT(*) AS count FROM transactions WHERE owner_id = ? AND occurred_at >= ? AND occurred_at < ?')
    .get(userId, monthStart, monthEnd) as { count: number };

  return {
    totals: {
      savedOre,
      targetOre,
      progressBps,
      activeGoals: active.length,
      transactionsThisMonth: transactionCount.count,
    },
    month,
    goals: active.slice(0, 4),
    nextMilestone,
    level: achievementInfo.level,
    achievements: { earned: achievementInfo.totalEarned, total: achievementInfo.catalog.length },
    competitions,
    recentTransactions,
    serverTime: nowIso(),
  };
}
