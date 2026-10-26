import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createGoal, createHarness, deposit, signup } from './helpers.js';
import { setTestClock } from '../src/lib/time.js';
import { syncGoalAchievements } from '../src/services/achievements.js';

const FIXED_NOW = Date.parse('2026-07-01T09:00:00.000Z');

beforeEach(() => setTestClock(FIXED_NOW));
afterAll(() => setTestClock(null));

describe('16. Achievements cannot be granted repeatedly', () => {
  it('awards each milestone once per goal and keeps the history', async () => {
    const harness = await createHarness();
    try {
      const { client, user } = await signup(harness.app, 'badge@example.com', { alias: 'badge_samlare' });
      const goal = await createGoal(client, 'Sommarmål', 1_000_000);

      // 10 % -> First steps only.
      const first = await deposit(client, goal.id, 100_000);
      expect(first.newlyEarned.map((award: { code: string }) => award.code)).toEqual(['first_steps']);

      // 25 % -> Building momentum only (no repeats).
      const second = await deposit(client, goal.id, 150_000);
      expect(second.newlyEarned.map((award: { code: string }) => award.code)).toEqual(['building_momentum']);

      // Same balance again: nothing new.
      const third = await deposit(client, goal.id, 10_000);
      expect(third.newlyEarned).toEqual([]);

      // 50 % -> Halfway there.
      const fourth = await deposit(client, goal.id, 240_000);
      expect(fourth.newlyEarned.map((award: { code: string }) => award.code)).toEqual(['halfway_there']);

      // A second verification pass must not create duplicates either.
      const repeated = await syncGoalAchievements(harness.db, user.id, goal.id, 400_000, 1_000_000);
      expect(repeated).toEqual([]);

      const counts = await harness.db.prepare(
          `SELECT achievement_id, COUNT(*) AS count FROM user_achievements
           WHERE user_id = ? AND goal_id = ? GROUP BY achievement_id`,
        )
        .all(user.id, goal.id) as Array<{ achievement_id: string; count: number }>;
      expect(counts.length).toBe(3);
      for (const row of counts) expect(row.count).toBe(1);

      // progressBps floors, so 24.99 % must not award the 25 % badge.
      const secondGoal = await createGoal(client, 'Precisionsmål', 10_000);
      const nearMiss = await deposit(client, secondGoal.id, 2_499);
      expect(nearMiss.newlyEarned.map((award: { code: string }) => award.code)).toEqual(['first_steps']);
      const exact = await deposit(client, secondGoal.id, 1);
      expect(exact.newlyEarned.map((award: { code: string }) => award.code)).toEqual(['building_momentum']);

      const catalog = (await client.get('/api/achievements')).body;
      const firstSteps = catalog.catalog.find((item: { code: string }) => item.code === 'first_steps');
      expect(firstSteps.earnedCount).toBe(2); // one per goal, history preserved
      expect(catalog.totalEarned).toBe(3); // distinct badges
      expect(catalog.totalAwards).toBe(5); // full history across goals

      // Award history survives archiving.
      await client.post(`/api/goals/${goal.id}/archive`);
      const afterArchive = (await client.get('/api/achievements')).body;
      expect(afterArchive.catalog.find((item: { code: string }) => item.code === 'halfway_there').earnedCount).toBe(1);
      expect(afterArchive.totalEarned).toBe(3);
      expect(afterArchive.totalAwards).toBe(5);
    } finally {
      await harness.close();
    }
  });

  it('grants the full ladder exactly once at 100 %', async () => {
    const harness = await createHarness();
    try {
      const { client } = await signup(harness.app, 'goal@example.com', { alias: 'mal_klart' });
      const goal = await createGoal(client, 'Klar', 100_000);
      const result = await deposit(client, goal.id, 100_000);
      expect(result.newlyEarned.map((award: { code: string }) => award.code)).toEqual([
        'first_steps',
        'building_momentum',
        'halfway_there',
        'nearly_there',
        'goal_achieved',
      ]);
      expect(result.goal.progressPercentage).toBe(100);
      expect(result.goal.remainingOre).toBe(0);

      const extra = await deposit(client, goal.id, 50_000);
      expect(extra.newlyEarned).toEqual([]);
    } finally {
      await harness.close();
    }
  });
});
