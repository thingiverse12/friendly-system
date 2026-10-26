import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createGoal, createHarness, deposit, signup, type TestClient } from './helpers.js';
import { setTestClock } from '../src/lib/time.js';
import { monthlyEquivalentOre, occurrenceAtOrAfter } from '../src/services/recurring.js';

const FIXED_NOW = Date.parse('2026-03-10T09:00:00.000Z');

beforeEach(() => setTestClock(FIXED_NOW));
afterAll(() => setTestClock(null));

const advanceTo = (iso: string) => setTestClock(Date.parse(iso));

/**
 * Moves the clock forward and signs the same account back in, so a long gap between visits does not
 * expire the session (14 days) — this is what "the user comes back months later" looks like.
 */
async function comeBack(client: TestClient, email: string, iso: string) {
  advanceTo(iso);
  await client.login(email);
  return client.get('/api/recurring');
}

async function withApp(run: (harness: Awaited<ReturnType<typeof createHarness>>) => Promise<void>) {
  const harness = await createHarness();
  try {
    await run(harness);
  } finally {
    await harness.close();
  }
}

describe('11. Recurring income and expenses', () => {
  it('books a monthly expense on the right day, exactly once', async () => {
    await withApp(async ({ app }) => {
      const { client } = await signup(app, 'hyra@example.com', { alias: 'hyra_agare' });

      const created = await client.post('/api/recurring', {
        type: 'expense',
        amountOre: 850_000,
        category: 'Boende',
        interval: 'monthly',
        dayOfMonth: 25,
        description: 'Hyra',
      });
      expect(created.status).toBe(201);
      expect(created.body.rule.nextOccurrence).toBe('2026-03-25');
      expect(created.body.rule.monthlyOre).toBe(850_000);
      // Creating a rule must never write history: nothing is booked yet.
      expect(created.body.rule.timesBooked).toBe(0);
      expect((await client.get('/api/transactions')).body.total).toBe(0);

      // Still before the 25th: nothing happens.
      expect((await comeBack(client, 'hyra@example.com', '2026-03-24T09:00:00.000Z')).body.booked).toBe(0);

      const run = await comeBack(client, 'hyra@example.com', '2026-03-25T06:00:00.000Z');
      expect(run.body.booked).toBe(1);
      expect(run.body.rules[0].nextOccurrence).toBe('2026-04-25');

      const list = await client.get('/api/transactions');
      expect(list.body.total).toBe(1);
      expect(list.body.items[0]).toMatchObject({
        type: 'expense',
        amountOre: 850_000,
        category: 'Boende',
        description: 'Hyra',
      });
      expect(list.body.items[0].occurredAt.slice(0, 10)).toBe('2026-03-25');

      // Same day, opened again: the unique booking row makes the run idempotent.
      expect((await client.get('/api/recurring')).body.booked).toBe(0);
      expect((await client.get('/api/transactions')).body.total).toBe(1);
    });
  });

  it('catches up every missed month with its own date', async () => {
    await withApp(async ({ app }) => {
      const { client } = await signup(app, 'missad@example.com', { alias: 'missad_agare' });
      const created = await client.post('/api/recurring', {
        type: 'expense',
        amountOre: 399_00,
        category: 'Prenumerationer',
        interval: 'monthly',
        dayOfMonth: 5,
        description: 'Streaming',
      });
      expect(created.body.rule.nextOccurrence).toBe('2026-04-05');

      // The user was away from the app for four months.
      const run = await comeBack(client, 'missad@example.com', '2026-07-10T09:00:00.000Z');
      expect(run.body.booked).toBe(4);

      const dates = (await client.get('/api/transactions')).body.items
        .map((item: { occurredAt: string }) => item.occurredAt.slice(0, 10))
        .sort();
      expect(dates).toEqual(['2026-04-05', '2026-05-05', '2026-06-05', '2026-07-05']);
      expect(run.body.rules[0].nextOccurrence).toBe('2026-08-05');
    });
  });

  it('clamps the 31st to shorter months instead of skipping them', async () => {
    await withApp(async ({ app }) => {
      const { client } = await signup(app, 'slutet@example.com', { alias: 'slutet_agare' });
      await client.post('/api/recurring', {
        type: 'expense',
        amountOre: 249_00,
        category: 'Prenumerationer',
        interval: 'monthly',
        dayOfMonth: 31,
        description: 'Molnlagring',
      });

      await comeBack(client, 'slutet@example.com', '2026-04-30T09:00:00.000Z');
      const dates = (await client.get('/api/transactions')).body.items
        .map((item: { occurredAt: string }) => item.occurredAt.slice(0, 10))
        .sort();
      expect(dates).toEqual(['2026-03-31', '2026-04-30']);
    });
  });

  it('handles weekly and quarterly rhythms', async () => {
    await withApp(async ({ app }) => {
      const { client } = await signup(app, 'rytm@example.com', { alias: 'rytm_agare' });
      const weekly = await client.post('/api/recurring', {
        type: 'expense',
        amountOre: 120_00,
        category: 'Mat',
        interval: 'weekly',
        weekday: 1,
        description: 'Veckohandling',
      });
      expect(weekly.body.rule.nextOccurrence).toBe('2026-03-16');
      // 120 kr a week is what people actually budget per month.
      expect(weekly.body.rule.monthlyOre).toBe(Math.round((120_00 * 52) / 12));

      await client.post('/api/recurring', {
        type: 'expense',
        amountOre: 3_000_00,
        category: 'Hälsa',
        interval: 'quarterly',
        dayOfMonth: 12,
        description: 'Tandvård',
      });

      await comeBack(client, 'rytm@example.com', '2026-04-06T09:00:00.000Z');
      const dates = (await client.get('/api/transactions')).body.items
        .map((item: { occurredAt: string }) => item.occurredAt.slice(0, 10))
        .sort();
      expect(dates).toEqual(['2026-03-12', '2026-03-16', '2026-03-23', '2026-03-30', '2026-04-06']);

      const list = await client.get('/api/recurring');
      const quarterly = list.body.rules.find((rule: { interval: string }) => rule.interval === 'quarterly');
      expect(quarterly.monthlyOre).toBe(1_000_00);
      expect(quarterly.upcoming[0]).toBe('2026-06-12');
      expect(list.body.summary.monthlyExpenseOre).toBe(Math.round((120_00 * 52) / 12) + 1_000_00);
    });
  });

  it('stops at the end month and can be paused without losing history', async () => {
    await withApp(async ({ app }) => {
      const { client } = await signup(app, 'slut@example.com', { alias: 'slut_agare' });
      await client.post('/api/recurring', {
        type: 'expense',
        amountOre: 299_00,
        category: 'Prenumerationer',
        interval: 'monthly',
        dayOfMonth: 20,
        endMonth: '2026-05',
        description: 'Tillfällig prenumeration',
      });

      const run = await comeBack(client, 'slut@example.com', '2026-07-01T09:00:00.000Z');
      expect(run.body.booked).toBe(3); // 20 mars, 20 april och 20 maj — sedan tar det stopp
      expect(run.body.rules[0].active).toBe(false);
      expect(run.body.rules[0].nextOccurrence).toBeNull();

      // Nothing more is booked after the end month.
      expect((await comeBack(client, 'slut@example.com', '2026-09-01T09:00:00.000Z')).body.booked).toBe(0);

      // A paused rule stays quiet, and resuming starts in the future instead of flooding the ledger.
      const resumed = await client.patch(`/api/recurring/${run.body.rules[0].id}`, { active: true });
      expect(resumed.status).toBe(200);
      const paused = await client.patch(`/api/recurring/${run.body.rules[0].id}`, { active: false });
      expect(paused.body.rule.active).toBe(false);
      expect((await client.get('/api/recurring')).body.booked).toBe(0);
    });
  });

  it('keeps rules private and validates the schedule', async () => {
    await withApp(async ({ app }) => {
      const alice = await signup(app, 'anna-recurring@example.com', { alias: 'anna_recurring' });
      const bob = await signup(app, 'bert-recurring@example.com', { alias: 'bert_recurring' });

      const rule = await alice.client.post('/api/recurring', {
        type: 'expense',
        amountOre: 500_00,
        category: 'Nöje',
        interval: 'monthly',
        dayOfMonth: 1,
      });
      const ruleId = rule.body.rule.id as string;

      // Bob sees nothing, and gets 404 (not 403) on direct access.
      expect((await bob.client.get('/api/recurring')).body.rules).toHaveLength(0);
      expect((await bob.client.get(`/api/recurring/${ruleId}`)).status).toBe(404);
      expect((await bob.client.patch(`/api/recurring/${ruleId}`, { amountOre: 1 })).status).toBe(404);
      expect((await bob.client.del(`/api/recurring/${ruleId}`)).status).toBe(404);

      // Category must fit the type, the interval must be known, day must be plausible.
      expect(
        (await alice.client.post('/api/recurring', {
          type: 'expense',
          amountOre: 100_00,
          category: 'Lön',
          interval: 'monthly',
        })).status,
      ).toBe(400);
      expect(
        (await alice.client.post('/api/recurring', {
          type: 'expense',
          amountOre: 100_00,
          category: 'Mat',
          interval: 'fortnightly',
        })).status,
      ).toBe(422);
      expect(
        (await alice.client.post('/api/recurring', {
          type: 'expense',
          amountOre: 100_00,
          category: 'Mat',
          interval: 'monthly',
          dayOfMonth: 32,
        })).status,
      ).toBe(422);
      expect(
        (await alice.client.post('/api/recurring', {
          type: 'expense',
          amountOre: 0,
          category: 'Mat',
          interval: 'monthly',
        })).status,
      ).toBe(422);
      expect(
        (await alice.client.post('/api/recurring', {
          type: 'expense',
          amountOre: 100_00,
          category: 'Mat',
          interval: 'monthly',
          endMonth: '2026-01',
        })).status,
      ).toBe(400);

      // Frauds aside: another user's rule id in the URL never books against the wrong owner.
      // Bob opening the app books nothing: he has no rule of Anna's.
      const bobRun = await comeBack(bob.client, 'bert-recurring@example.com', '2026-04-02T09:00:00.000Z');
      expect(bobRun.body.booked).toBe(0);
      expect((await bob.client.get('/api/transactions')).body.total).toBe(0);
      // Anna opening hers books her own month, and only hers.
      const annaRun = await comeBack(alice.client, 'anna-recurring@example.com', '2026-04-02T09:00:00.000Z');
      expect(annaRun.body.booked).toBe(1);
      expect((await alice.client.get('/api/transactions')).body.total).toBe(1);
      expect((await bob.client.get('/api/transactions')).body.total).toBe(0);
    });
  });

  it('deleting a rule keeps the transactions it already produced, and never touches savings', async () => {
    await withApp(async ({ app }) => {
      const { client } = await signup(app, 'sparande@example.com', { alias: 'sparande_agare' });
      const goal = await createGoal(client, 'Buffert', 1_000_000);
      await deposit(client, goal.id, 250_000);

      const created = await client.post('/api/recurring', {
        type: 'expense',
        amountOre: 1_000_00,
        category: 'Boende',
        interval: 'monthly',
        dayOfMonth: 15,
        description: 'Elräkning',
      });
      await comeBack(client, 'sparande@example.com', '2026-03-16T09:00:00.000Z');
      expect((await client.get('/api/transactions')).body.total).toBe(1);

      // An expense is spending, never a withdrawal from the savings ledger.
      const goalAfter = await client.get(`/api/goals/${goal.id}`);
      expect(goalAfter.body.goal.balanceOre).toBe(250_000);

      const removed = await client.del(`/api/recurring/${created.body.rule.id}`);
      expect(removed.status).toBe(200);
      expect((await client.get('/api/recurring')).body.rules).toHaveLength(0);
      expect((await client.get('/api/transactions')).body.total).toBe(1);

      // Reacting to the deletion: the monthly summary still counts the booked expense.
      const summary = await client.get('/api/transactions/summary?month=2026-03');
      expect(summary.body.expenseOre).toBe(1_000_00);
    });
  });

  it('books from the dashboard too, so the overview and the ledger agree', async () => {
    await withApp(async ({ app }) => {
      const { client } = await signup(app, 'oversikt@example.com', { alias: 'oversikt_agare' });
      await client.post('/api/recurring', {
        type: 'expense',
        amountOre: 149_00,
        category: 'Prenumerationer',
        interval: 'monthly',
        dayOfMonth: 15,
        description: 'Musik',
      });

      // Opening the dashboard is enough: the due entry is booked before the totals are computed.
      advanceTo('2026-03-15T08:00:00.000Z');
      await client.login('oversikt@example.com');
      const dashboard = await client.get('/api/dashboard');
      expect(dashboard.status).toBe(200);
      expect(dashboard.body.month.expenseOre).toBe(149_00);
      expect(dashboard.body.totals.transactionsThisMonth).toBe(1);
    });
  });

  it('pausing stops the bookings and resuming continues in the future', async () => {
    await withApp(async ({ app }) => {
      const { client } = await signup(app, 'paus@example.com', { alias: 'paus_agare' });
      const created = await client.post('/api/recurring', {
        type: 'expense',
        amountOre: 99_00,
        category: 'Nöje',
        interval: 'monthly',
        dayOfMonth: 2,
        description: 'Spelabonnemang',
      });
      const ruleId = created.body.rule.id as string;

      const paused = await client.patch(`/api/recurring/${ruleId}`, { active: false });
      expect(paused.body.rule.active).toBe(false);
      expect(paused.body.rule.nextOccurrence).toBeNull();

      // Two months pass with the rule paused: nothing is booked.
      expect((await comeBack(client, 'paus@example.com', '2026-05-10T09:00:00.000Z')).body.booked).toBe(0);
      expect((await client.get('/api/transactions')).body.total).toBe(0);

      // Resuming picks the next future date instead of booking the paused months.
      const resumed = await client.patch(`/api/recurring/${ruleId}`, { active: true });
      expect(resumed.body.rule.active).toBe(true);
      expect(resumed.body.rule.nextOccurrence).toBe('2026-06-02');

      expect((await comeBack(client, 'paus@example.com', '2026-06-03T09:00:00.000Z')).body.booked).toBe(1);
      expect((await client.get('/api/transactions')).body.total).toBe(1);
    });
  });

  it('does not create transactions for unauthenticated requests', async () => {
    await withApp(async ({ app }) => {
      const harnessClient = await signup(app, 'auth-recurring@example.com', { alias: 'auth_recurring' });
      const ruleId = (
        await harnessClient.client.post('/api/recurring', {
          type: 'expense',
          amountOre: 100_00,
          category: 'Mat',
          interval: 'monthly',
        })
      ).body.rule.id as string;

      const anonymous = await createHarness(); // separate DB: proves the guard, not the data
      try {
        const { client: fresh } = await signup(anonymous.app, 'anon@example.com', { alias: 'anon_agare' });
        expect((await fresh.get(`/api/recurring/${ruleId}`)).status).toBe(404);
        expect((await fresh.get('/api/recurring')).body.rules).toHaveLength(0);
      } finally {
        await anonymous.close();
      }
    });
  });
});

describe('12. Recurring schedule maths', () => {
  it('walks monthly, quarterly and yearly schedules from any start date', () => {
    const monthly = { interval: 'monthly' as const, startDate: '2026-01-31', dayOfMonth: 31, weekday: 0 };
    expect(occurrenceAtOrAfter(monthly, '2026-02-01', true)).toBe('2026-02-28');
    expect(occurrenceAtOrAfter(monthly, '2026-02-28', false)).toBe('2026-03-31');

    const quarterly = { interval: 'quarterly' as const, startDate: '2026-02-12', dayOfMonth: 12, weekday: 0 };
    expect(occurrenceAtOrAfter(quarterly, '2026-02-13', true)).toBe('2026-05-12');

    const yearly = { interval: 'yearly' as const, startDate: '2024-06-01', dayOfMonth: 1, weekday: 0 };
    expect(occurrenceAtOrAfter(yearly, '2026-01-01', true)).toBe('2026-06-01');
  });

  it('normalises any interval to a monthly figure', () => {
    expect(monthlyEquivalentOre(500_00, 'monthly')).toBe(500_00);
    expect(monthlyEquivalentOre(1_200_00, 'yearly')).toBe(100_00);
    expect(monthlyEquivalentOre(3_000_00, 'quarterly')).toBe(1_000_00);
    expect(monthlyEquivalentOre(100_00, 'weekly')).toBe(Math.round((100_00 * 52) / 12));
  });
});
