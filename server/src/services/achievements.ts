import type { Db } from '../db.js';
import { progressBps } from '../lib/money.js';
import { uuid } from '../lib/ids.js';
import { nowIso } from '../lib/time.js';

export interface EarnedAchievement {
  code: string;
  name: string;
  description: string;
  badge: string;
  milestoneBps: number;
  goalId: string;
  earnedAt: string;
}

interface AchievementRow {
  id: string;
  code: string;
  name: string;
  description: string;
  milestone_bps: number;
  badge: string;
}

/**
 * Awards every milestone the goal has legitimately reached.
 * - Verification happens only here, on the server, from the authoritative balance.
 * - UNIQUE(user_id, achievement_id, goal_id) plus INSERT OR IGNORE makes duplicate awards impossible.
 * - Existing rows are never updated or deleted, so the earned history stays intact.
 */
export async function syncGoalAchievements(
  db: Db,
  userId: string,
  goalId: string,
  balanceOre: number,
  targetOre: number,
): Promise<EarnedAchievement[]>{
  const bps = progressBps(balanceOre, targetOre);
  const achievements = await db
    .prepare('SELECT id, code, name, description, milestone_bps, badge FROM achievements ORDER BY milestone_bps')
    .all() as AchievementRow[];
  const insert = db.prepare(
    `INSERT INTO user_achievements
       (id, user_id, achievement_id, goal_id, earned_at, progress_bps_at_award)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id, achievement_id, goal_id) DO NOTHING`,
  );
  const earned: EarnedAchievement[] = [];
  for (const achievement of achievements) {
    if (bps < achievement.milestone_bps) continue;
    const result = await insert.run(uuid(), userId, achievement.id, goalId, nowIso(), bps);
    if (result > 0) {
      earned.push({
        code: achievement.code,
        name: achievement.name,
        description: achievement.description,
        badge: achievement.badge,
        milestoneBps: achievement.milestone_bps,
        goalId,
        earnedAt: nowIso(),
      });
    }
  }
  return earned;
}

export interface LevelInfo {
  level: number;
  name: string;
  earnedCount: number;
  nextLevelAt: number | null;
  progressToNextBps: number;
}

// Levels are driven by distinct unlocked badges (there are five), so the ladder is achievable.
const LEVELS: Array<{ level: number; name: string; min: number }> = [
  { level: 1, name: 'Nybörjare', min: 0 },
  { level: 2, name: 'Sparare', min: 2 },
  { level: 3, name: 'Målmedveten', min: 3 },
  { level: 4, name: 'Sparproffs', min: 4 },
  { level: 5, name: 'Sparmästare', min: 5 },
];

export async function levelFor(earnedCount: number): Promise<LevelInfo>{
  let current = LEVELS[0]!;
  for (const level of LEVELS) if (earnedCount >= level.min) current = level;
  const next = LEVELS.find((level) => level.min > earnedCount) ?? null;
  const span = next ? next.min - current.min : 1;
  const progress = next ? Math.min(10000, Math.floor(((earnedCount - current.min) * 10000) / span)) : 10000;
  return {
    level: current.level,
    name: current.name,
    earnedCount,
    nextLevelAt: next ? next.min : null,
    progressToNextBps: progress,
  };
}

export interface AchievementCatalogItem {
  code: string;
  name: string;
  description: string;
  badge: string;
  milestoneBps: number;
  earnedCount: number;
  earnedAt: string | null;
  goals: Array<{ goalId: string; goalName: string; earnedAt: string }>;
}

/** Full catalog for the signed-in user; only their own awards are included. */
export async function achievementCatalog(db: Db, userId: string): Promise<{
  catalog: AchievementCatalogItem[];
  level: LevelInfo;
  /** Distinct badges unlocked. */
  totalEarned: number;
  /** Total awards across all goals (history length). */
  totalAwards: number;
}> {
  const achievements = await db
    .prepare('SELECT id, code, name, description, milestone_bps, badge FROM achievements ORDER BY sort_order')
    .all() as AchievementRow[];
  const awards = await db
    .prepare(
      `SELECT ua.achievement_id, ua.goal_id, ua.earned_at, g.name AS goal_name
       FROM user_achievements ua
       JOIN savings_goals g ON g.id = ua.goal_id AND g.owner_id = ua.user_id
       WHERE ua.user_id = ?`,
    )
    .all(userId) as Array<{ achievement_id: string; goal_id: string; earned_at: string; goal_name: string }>;

  const catalog = achievements.map((achievement) => {
    const rows = awards.filter((award) => award.achievement_id === achievement.id);
    return {
      code: achievement.code,
      name: achievement.name,
      description: achievement.description,
      badge: achievement.badge,
      milestoneBps: achievement.milestone_bps,
      earnedCount: rows.length,
      earnedAt: rows.length ? rows.map((row) => row.earned_at).sort().at(-1)! : null,
      goals: rows.map((row) => ({ goalId: row.goal_id, goalName: row.goal_name, earnedAt: row.earned_at })),
    };
  });
  const totalEarned = catalog.filter((item) => item.earnedCount > 0).length;
  return { catalog, level: await levelFor(totalEarned), totalEarned, totalAwards: awards.length };
}

/** Highest "approved" badge for leaderboards. Only shown when the user opted in to badge sharing. */
export async function topBadgeFor(db: Db, userId: string): Promise<string | null>{
  const row = await db
    .prepare(
      `SELECT a.badge FROM user_achievements ua
       JOIN achievements a ON a.id = ua.achievement_id
       JOIN profiles p ON p.user_id = ua.user_id
       WHERE ua.user_id = ? AND p.share_badges = 1
       ORDER BY a.milestone_bps DESC LIMIT 1`,
    )
    .get(userId) as { badge: string } | undefined;
  return row?.badge ?? null;
}
