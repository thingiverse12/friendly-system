import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createGoal, createHarness, DAY, deposit, signup } from './helpers.js';
import { advanceTestClock, setTestClock, toIso } from '../src/lib/time.js';
import { createCompetition, syncCompetitionLifecycle } from '../src/services/competitions.js';
import { scoreCenti } from '../src/lib/money.js';

const FIXED_NOW = Date.parse('2026-05-04T07:30:00.000Z');

beforeEach(() => setTestClock(FIXED_NOW));
afterAll(() => setTestClock(null));

async function setup(app: Parameters<typeof signup>[0], email: string, alias: string) {
  const account = await signup(app, email, { alias });
  await account.client.patch('/api/profile', { publicCompetitionConsent: true });
  return account;
}

describe('9. Locked goals cannot change target during an active competition', () => {
  it('rejects target changes, archiving and deletion while a competition is active', async () => {
    const harness = await createHarness();
    try {
      const { client } = await setup(harness.app, 'lock@example.com', 'las_anvandare');
      const goal = await createGoal(client, 'Låst mål', 500_000);
      await deposit(client, goal.id, 100_000);

      const competition = await createCompetition(harness.db, {
        name: '7-dagars spartävling',
        durationDays: 7,
        visibility: 'public',
        startsAt: toIso(FIXED_NOW),
      });
      await syncCompetitionLifecycle(harness.db);
      const joined = await client.post(`/api/competitions/${competition.id}/join`, { goalId: goal.id });
      expect(joined.status).toBe(201);

      const patchTarget = await client.patch(`/api/goals/${goal.id}`, { targetAmountOre: 600_000 });
      expect(patchTarget.status).toBe(409);
      expect(patchTarget.body.error.message).toMatch(/låst/i);

      // Renaming stays possible, the target does not move.
      const rename = await client.patch(`/api/goals/${goal.id}`, { name: 'Nytt namn' });
      expect(rename.status).toBe(200);
      expect(rename.body.goal.targetAmountOre).toBe(500_000);

      expect((await client.post(`/api/goals/${goal.id}/archive`)).status).toBe(409);
      expect((await client.del(`/api/goals/${goal.id}`)).status).toBe(409);

      // After the competition is over the target can be edited again.
      advanceTestClock(8 * DAY);
      await client.get(`/api/competitions/${competition.id}/leaderboard`);
      const unlocked = await client.patch(`/api/goals/${goal.id}`, { targetAmountOre: 700_000 });
      expect(unlocked.status).toBe(200);
    } finally {
      await harness.close();
    }
  });
});

describe('10. Competition scoring follows the specified formula', () => {
  it('scores 100 × (current − starting) / locked target, allows negatives and shared ranks', async () => {
    const harness = await createHarness();
    try {
      const alice = await setup(harness.app, 'score-a@example.com', 'poang_alice');
      const bob = await setup(harness.app, 'score-b@example.com', 'poang_bob');

      const aliceGoal = await createGoal(alice.client, 'Resa', 500_000);
      const bobGoal = await createGoal(bob.client, 'Bil', 500_000);
      await deposit(alice.client, aliceGoal.id, 100_000);
      await deposit(bob.client, bobGoal.id, 100_000);

      const competition = await createCompetition(harness.db, {
        name: 'Poängprov',
        durationDays: 7,
        visibility: 'public',
        startsAt: toIso(FIXED_NOW),
      });
      await syncCompetitionLifecycle(harness.db);
      expect((await alice.client.post(`/api/competitions/${competition.id}/join`, { goalId: aliceGoal.id })).status).toBe(201);
      expect((await bob.client.post(`/api/competitions/${competition.id}/join`, { goalId: bobGoal.id })).status).toBe(201);

      // Example from the specification: target 5000, start 1000, current 1500 => 10 points.
      await deposit(alice.client, aliceGoal.id, 50_000);
      let board = await alice.client.get(`/api/competitions/${competition.id}/leaderboard`);
      const aliceEntry = board.body.entries.find((entry: { isYou: boolean }) => entry.isYou);
      expect(aliceEntry.scoreCenti).toBe(scoreCenti(150_000, 100_000, 500_000));
      expect(aliceEntry.score).toBe(10);

      // Bob matches the score exactly: both share rank 1.
      await deposit(bob.client, bobGoal.id, 50_000);
      board = await alice.client.get(`/api/competitions/${competition.id}/leaderboard`);
      const scores = board.body.entries.map((entry: { score: number }) => entry.score);
      expect(scores).toEqual([10, 10]);
      expect(board.body.entries.map((entry: { rank: number }) => entry.rank)).toEqual([1, 1]);

      // Withdrawals reduce the score, and negative scores are allowed.
      await alice.client.post(`/api/goals/${aliceGoal.id}/movements`, { type: 'withdrawal', amountOre: 100_000 });
      board = await alice.client.get(`/api/competitions/${competition.id}/leaderboard`);
      const afterWithdrawal = board.body.entries.find((entry: { isYou: boolean }) => entry.isYou);
      expect(afterWithdrawal.score).toBe(-10);
      expect(board.body.entries[0]!.isYou).toBe(false); // bob is now first
      expect(board.body.entries[1]!.rank).toBe(2);

      // Scores are computed from authoritative balances, never from request input.
      const forged = await alice.client.post(`/api/competitions/${competition.id}/score`, { score: 9999 });
      expect(forged.status).toBe(403);
      board = await alice.client.get(`/api/competitions/${competition.id}/leaderboard`);
      expect(board.body.entries.find((entry: { isYou: boolean }) => entry.isYou).score).toBe(-10);
    } finally {
      await harness.close();
    }
  });
});

describe('11. Historical savings do not generate competition points', () => {
  it('ignores savings made before the competition starts', async () => {
    const harness = await createHarness();
    try {
      const alice = await setup(harness.app, 'history@example.com', 'historik_alice');
      const goal = await createGoal(alice.client, 'Buffert', 1_000_000);
      await deposit(alice.client, goal.id, 300_000);

      const competition = await createCompetition(harness.db, {
        name: 'Historikprov',
        durationDays: 7,
        visibility: 'public',
        startsAt: toIso(FIXED_NOW),
      });
      await syncCompetitionLifecycle(harness.db);
      expect((await alice.client.post(`/api/competitions/${competition.id}/join`, { goalId: goal.id })).status).toBe(201);

      const board = await alice.client.get(`/api/competitions/${competition.id}/leaderboard`);
      expect(board.body.entries[0]!.score).toBe(0);
    } finally {
      await harness.close();
    }
  });

  it('snapshots upcoming competitions at the moment the server starts them', async () => {
    const harness = await createHarness();
    try {
      const alice = await setup(harness.app, 'upcoming@example.com', 'kommande_alice');
      const goal = await createGoal(alice.client, 'Framtidsmål', 1_000_000);
      await deposit(alice.client, goal.id, 100_000);

      const competition = await createCompetition(harness.db, {
        name: 'Framtida tävling',
        durationDays: 7,
        visibility: 'public',
        startsAt: toIso(FIXED_NOW + 3_600_000),
      });
      const joined = await alice.client.post(`/api/competitions/${competition.id}/join`, { goalId: goal.id });
      expect(joined.status).toBe(201);
      expect(joined.body.participant.startingBalanceOre).toBeNull();

      // Saving while the competition is still upcoming does not count.
      await deposit(alice.client, goal.id, 200_000);
      advanceTestClock(2 * 3_600_000);
      const started = await alice.client.get(`/api/competitions/${competition.id}/leaderboard`);
      expect(started.body.status).toBe('active');
      expect(started.body.entries[0]!.score).toBe(0);
      const detail = await alice.client.get(`/api/competitions/${competition.id}`);
      expect(detail.body.myParticipation.startingBalanceOre).toBe(300_000);
      expect(detail.body.myParticipation.snapshotFrozen).toBe(true);

      // Only savings after the start count.
      await deposit(alice.client, goal.id, 100_000);
      const after = await alice.client.get(`/api/competitions/${competition.id}/leaderboard`);
      expect(after.body.entries[0]!.score).toBe(10);
    } finally {
      await harness.close();
    }
  });
});

describe('12. Clients cannot modify locked snapshots or final scores', () => {
  it('blocks score submission, snapshot edits and final result changes', async () => {
    const harness = await createHarness();
    try {
      const alice = await setup(harness.app, 'immutable@example.com', 'last_alice');
      const goal = await createGoal(alice.client, 'Orubbligt mål', 400_000);
      await deposit(alice.client, goal.id, 100_000);

      const competition = await createCompetition(harness.db, {
        name: 'Låstävling',
        durationDays: 7,
        visibility: 'public',
        startsAt: toIso(FIXED_NOW),
      });
      await syncCompetitionLifecycle(harness.db);
      await alice.client.post(`/api/competitions/${competition.id}/join`, { goalId: goal.id });
      const participant = await harness.db.prepare('SELECT * FROM competition_participants WHERE competition_id = ?')
        .get(competition.id) as {
        id: string;
        last_message?: string;
      };

      expect((await alice.client.post(`/api/competitions/${competition.id}/score`, { score: 100 })).status).toBe(403);
      expect((await alice.client.patch(`/api/competitions/${competition.id}`, { startsAt: toIso(FIXED_NOW - DAY) })).status).toBe(404);
      expect(
        (await alice.client.patch(`/api/competitions/${competition.id}/participants/${participant.id}`, {
          startingBalanceOre: 0,
        })).status,
      ).toBe(404);

      // Even a direct SQL update cannot rewrite a frozen snapshot.
      await expect(harness.db.prepare('UPDATE competition_participants SET starting_balance_ore = 0 WHERE id = ?')
          .run(participant.id),).rejects.toThrow(/locked_snapshot_immutable/);
      await expect(harness.db.prepare('UPDATE competition_participants SET locked_target_ore = 1 WHERE id = ?').run(participant.id),).rejects.toThrow(/locked_snapshot_immutable/);

      // Finish the competition: final scores and ranks are frozen.
      await deposit(alice.client, goal.id, 40_000);
      advanceTestClock(8 * DAY);
      const finished = await alice.client.get(`/api/competitions/${competition.id}/leaderboard`);
      expect(finished.body.status).toBe('completed');
      expect(finished.body.entries[0]!.score).toBe(10);
      expect(finished.body.entries[0]!.rank).toBe(1);

      await expect(harness.db.prepare('UPDATE competition_participants SET final_score_centi = 99999 WHERE id = ?').run(participant.id),).rejects.toThrow(/final_score_immutable/);
      await expect(harness.db.prepare("UPDATE competitions SET starts_at = '2030-01-01T00:00:00.000Z' WHERE id = ?").run(competition.id),).rejects.toThrow(/competition_finalised/);

      // Late joiners are rejected.
      const late = await setup(harness.app, 'late@example.com', 'sen_anvandare');
      const lateGoal = await createGoal(late.client, 'Sent mål', 400_000);
      expect((await late.client.post(`/api/competitions/${competition.id}/join`, { goalId: lateGoal.id })).status).toBe(409);
    } finally {
      await harness.close();
    }
  });
});

describe('13. Duplicate competition membership is rejected', () => {
  it('rejects a second participation from the same user', async () => {
    const harness = await createHarness();
    try {
      const alice = await setup(harness.app, 'dupe@example.com', 'dubbel_alice');
      const firstGoal = await createGoal(alice.client, 'Mål ett', 300_000);
      const secondGoal = await createGoal(alice.client, 'Mål två', 300_000);

      const competition = await createCompetition(harness.db, {
        name: 'Dubbelprov',
        durationDays: 7,
        visibility: 'public',
        startsAt: toIso(FIXED_NOW),
      });
      await syncCompetitionLifecycle(harness.db);

      expect((await alice.client.post(`/api/competitions/${competition.id}/join`, { goalId: firstGoal.id })).status).toBe(201);
      const duplicate = await alice.client.post(`/api/competitions/${competition.id}/join`, { goalId: secondGoal.id });
      expect(duplicate.status).toBe(409);
      expect(duplicate.body.error.message).toMatch(/redan/i);

      const count = await harness.db.prepare('SELECT COUNT(*) AS count FROM competition_participants WHERE competition_id = ?')
        .get(competition.id) as { count: number };
      expect(count.count).toBe(1);

      await expect(harness.db.prepare(
            `INSERT INTO competition_participants
               (id, competition_id, user_id, goal_id, starting_balance_ore, locked_target_ore, class_code, joined_at)
             VALUES (?, ?, (SELECT user_id FROM competition_participants LIMIT 1), ?, 0, 300000, '', ?)`,
          )
          .run('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', competition.id, secondGoal.id, toIso(FIXED_NOW)),).rejects.toThrow(/duplicate key|UNIQUE/i);
    } finally {
      await harness.close();
    }
  });
});
