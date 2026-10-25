import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createGoal, createHarness, deposit, signup } from './helpers.js';
import { setTestClock } from '../src/lib/time.js';
import {
  competitionClass,
  formatSek,
  isValidPositiveAmount,
  parseAmountToOre,
  progressBps,
  scoreCenti,
} from '../src/lib/money.js';

const FIXED_NOW = Date.parse('2026-02-01T10:00:00.000Z');

beforeEach(() => setTestClock(FIXED_NOW));
afterAll(() => setTestClock(null));

describe('Exact money arithmetic', () => {
  it('parses Swedish money strings into integer öre without floating point', () => {
    expect(parseAmountToOre('1250')).toBe(125_000);
    expect(parseAmountToOre('1250,50')).toBe(125_050);
    expect(parseAmountToOre('1 250,50 kr')).toBe(125_050);
    expect(parseAmountToOre('0,05')).toBe(5);
    expect(parseAmountToOre('0.1')).toBe(10);
    expect(parseAmountToOre('12,345')).toBeNull();
    expect(parseAmountToOre('abc')).toBeNull();
    expect(parseAmountToOre('')).toBeNull();
    expect(parseAmountToOre('-10')).toBe(-1000);
    // 0.1 + 0.2 stays exact in öre.
    expect((parseAmountToOre('0,10') ?? 0) + (parseAmountToOre('0,20') ?? 0)).toBe(30);
    expect(formatSek(30)).toBe('0,30 kr');
    // sv-SE groups thousands with a non-breaking space.
    expect(formatSek(2_500_000)).toBe('25\u00a0000 kr');
    expect(isValidPositiveAmount(0)).toBe(false);
    expect(isValidPositiveAmount(1)).toBe(true);
    expect(isValidPositiveAmount(1.5)).toBe(false);
  });

  it('computes progress and scoring exactly', () => {
    expect(progressBps(1_250_000, 2_500_000)).toBe(5000);
    expect(progressBps(1, 3)).toBe(3333);
    // formula: 100 * (current - start) / locked target, stored in centi-points
    expect(scoreCenti(150_000, 100_000, 500_000)).toBe(1000); // 10.00 points
    expect(scoreCenti(50_000, 100_000, 500_000)).toBe(-1000); // withdrawals can go negative
    expect(scoreCenti(500_000, 0, 300_000)).toBe(16667); // 166.67 points
    expect(competitionClass(100_000, 10_000)).toBe('A2');
    expect(competitionClass(2_500_000, 1_000_000)).toBe('C3'); // 40 % start share
  });
});

describe('6. Invalid monetary amounts are rejected', () => {
  it('rejects bad amounts on goals, movements and transactions', async () => {
    const harness = createHarness();
    try {
      const { client } = await signup(harness.app, 'amounts@example.com');
      for (const amount of [0, -1, -50000, 12.5, Number.NaN, 1e20, 999_999_999_999_999]) {
        const response = await client.post('/api/goals', { name: 'Test', targetAmountOre: amount });
        expect(response.status, `goal amount ${amount}`).toBe(422);
      }
      for (const amount of ['1000', null, undefined, {}, []]) {
        const response = await client.post('/api/goals', { name: 'Test', targetAmountOre: amount });
        expect(response.status, `goal amount ${JSON.stringify(amount)}`).toBe(422);
      }

      const goal = await createGoal(client, 'Giltigt mål', 500_000);
      for (const amount of [0, -100, 1.25, '250', 2e15]) {
        const depositResponse = await client.post(`/api/goals/${goal.id}/movements`, { type: 'deposit', amountOre: amount });
        expect(depositResponse.status, `movement ${amount}`).toBe(422);
        const txResponse = await client.post('/api/transactions', { type: 'expense', amountOre: amount, category: 'Mat' });
        expect(txResponse.status, `transaction ${amount}`).toBe(422);
      }

      // Nothing was written by the rejected requests.
      expect((await client.get(`/api/goals/${goal.id}`)).body.goal.balanceOre).toBe(0);
      expect((await client.get('/api/transactions')).body.total).toBe(0);

      const wrongCategory = await client.post('/api/transactions', {
        type: 'income',
        amountOre: 1000,
        category: 'Mat',
      });
      expect(wrongCategory.status).toBe(400);
      const unknownCategory = await client.post('/api/transactions', {
        type: 'expense',
        amountOre: 1000,
        category: 'Rymdresor',
      });
      expect(unknownCategory.status).toBe(422);
    } finally {
      harness.close();
    }
  });
});

describe('7. Deposits and withdrawals update balances correctly', () => {
  it('updates the goal balance and appends to the savings ledger', async () => {
    const harness = createHarness();
    try {
      const { client } = await signup(harness.app, 'balance@example.com');
      const goal = await createGoal(client, 'Buffert', 1_000_000);

      const first = await deposit(client, goal.id, 500_000);
      expect(first.goal.balanceOre).toBe(500_000);
      expect(first.movement.balanceAfterOre).toBe(500_000);

      const withdraw = await client.post(`/api/goals/${goal.id}/movements`, { type: 'withdrawal', amountOre: 125_000 });
      expect(withdraw.status).toBe(201);
      expect(withdraw.body.goal.balanceOre).toBe(375_000);
      expect(withdraw.body.movement.balanceAfterOre).toBe(375_000);

      const tooMuch = await client.post(`/api/goals/${goal.id}/movements`, { type: 'withdrawal', amountOre: 400_000 });
      expect(tooMuch.status).toBe(400);
      expect((await client.get(`/api/goals/${goal.id}`)).body.goal.balanceOre).toBe(375_000);

      const movements = (await client.get(`/api/goals/${goal.id}/movements`)).body.movements as Array<{
        type: string;
        amountOre: number;
        balanceAfterOre: number;
      }>;
      expect(movements.length).toBe(2);
      expect(movements[0]!.type).toBe('withdrawal');
      expect(movements[1]!.type).toBe('deposit');

      // Ledger and balance agree, and the balance is stored as an integer.
      const ledger = harness.db
        .prepare(
          `SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount_ore ELSE -amount_ore END), 0) AS total
           FROM savings_movements WHERE goal_id = ?`,
        )
        .get(goal.id) as { total: number };
      expect(ledger.total).toBe(375_000);
      const stored = harness.db.prepare('SELECT balance_ore AS balance FROM savings_goals WHERE id = ?').get(goal.id) as {
        balance: number;
      };
      expect(Number.isInteger(stored.balance)).toBe(true);
      expect(stored.balance).toBe(375_000);
    } finally {
      harness.close();
    }
  });
});

describe('8. Income does not automatically count as savings', () => {
  it('keeps transactions out of savings balances and ledgers', async () => {
    const harness = createHarness();
    try {
      const { client } = await signup(harness.app, 'income@example.com');
      const goal = await createGoal(client, 'Semester', 2_000_000);

      const income = await client.post('/api/transactions', {
        type: 'income',
        amountOre: 2_850_000,
        category: 'Lön',
      });
      expect(income.status).toBe(201);

      const detail = await client.get(`/api/goals/${goal.id}`);
      expect(detail.body.goal.balanceOre).toBe(0);
      expect(detail.body.movements).toEqual([]);

      const dashboard = await client.get('/api/dashboard');
      expect(dashboard.body.totals.savedOre).toBe(0);
      expect(dashboard.body.month.incomeOre).toBe(2_850_000);

      const movementCount = harness.db
        .prepare('SELECT COUNT(*) AS count FROM savings_movements WHERE owner_id = (SELECT id FROM users WHERE email = ?)')
        .get('income@example.com') as { count: number };
      expect(movementCount.count).toBe(0);

      // Only an explicit deposit changes savings.
      await deposit(client, goal.id, 200_000);
      const after = await client.get('/api/dashboard');
      expect(after.body.totals.savedOre).toBe(200_000);
      expect(after.body.month.incomeOre).toBe(2_850_000);
    } finally {
      harness.close();
    }
  });
});
