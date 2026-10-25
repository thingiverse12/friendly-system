import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createGoal, createHarness, deposit, signup } from './helpers.js';
import { setTestClock } from '../src/lib/time.js';
import { syncCompetitionLifecycle } from '../src/services/competitions.js';

const FIXED_NOW = Date.parse('2026-04-10T08:00:00.000Z');

beforeEach(() => setTestClock(FIXED_NOW));
afterAll(() => setTestClock(null));

describe('2. A user cannot read or modify another user’s data', () => {
  it('hides and protects other users’ transactions', async () => {
    const harness = createHarness();
    try {
      const alice = await signup(harness.app, 'alice@example.com', { alias: 'alice_spar' });
      const bob = await signup(harness.app, 'bob@example.com', { alias: 'bob_spar' });

      const bobTransaction = await bob.client.post('/api/transactions', {
        type: 'expense',
        amountOre: 49900,
        category: 'Mat',
        description: 'Bobs privata inköp',
      });
      expect(bobTransaction.status).toBe(201);
      const transactionId = bobTransaction.body.transaction.id as string;

      expect((await alice.client.get(`/api/transactions/${transactionId}`)).status).toBe(404);

      const patch = await alice.client.patch(`/api/transactions/${transactionId}`, { amountOre: 1, category: 'Mat' });
      expect(patch.status).toBe(404);

      const remove = await alice.client.del(`/api/transactions/${transactionId}`);
      expect(remove.status).toBe(404);

      const aliceList = await alice.client.get('/api/transactions');
      expect(aliceList.body.items).toEqual([]);

      const stillThere = await bob.client.get(`/api/transactions/${transactionId}`);
      expect(stillThere.status).toBe(200);
      expect(stillThere.body.transaction.amountOre).toBe(49900);
    } finally {
      harness.close();
    }
  });

  it('hides and protects other users’ goals, balances and ledgers', async () => {
    const harness = createHarness();
    try {
      const alice = await signup(harness.app, 'alice2@example.com', { alias: 'alice_two' });
      const bob = await signup(harness.app, 'bob2@example.com', { alias: 'bob_two' });

      const bobGoal = await createGoal(bob.client, 'Bobs hemliga mål', 1_000_000);
      await deposit(bob.client, bobGoal.id, 250_000);

      expect((await alice.client.get(`/api/goals/${bobGoal.id}`)).status).toBe(404);
      expect((await alice.client.get(`/api/goals/${bobGoal.id}/movements`)).status).toBe(404);
      expect((await alice.client.patch(`/api/goals/${bobGoal.id}`, { targetAmountOre: 1 })).status).toBe(404);
      expect((await alice.client.post(`/api/goals/${bobGoal.id}/archive`)).status).toBe(404);
      expect((await alice.client.del(`/api/goals/${bobGoal.id}`)).status).toBe(404);
      expect(
        (await alice.client.post(`/api/goals/${bobGoal.id}/movements`, { type: 'deposit', amountOre: 100 })).status,
      ).toBe(404);

      // Transactions cannot be attached to somebody else's goal either.
      const crossLink = await alice.client.post('/api/transactions', {
        type: 'expense',
        amountOre: 1000,
        category: 'Mat',
        goalId: bobGoal.id,
      });
      expect(crossLink.status).toBe(404);

      const aliceGoals = await alice.client.get('/api/goals');
      expect(aliceGoals.body.goals).toEqual([]);

      const bobDashboard = await bob.client.get('/api/dashboard');
      expect(bobDashboard.body.totals.savedOre).toBe(250_000);
    } finally {
      harness.close();
    }
  });
});

describe('3. Group members cannot access one another’s balances', () => {
  it('shares only aliases and roles inside a group', async () => {
    const harness = createHarness();
    try {
      const owner = await signup(harness.app, 'owner@example.com', { alias: 'grupp_agare' });
      const member = await signup(harness.app, 'member@example.com', { alias: 'grupp_medlem' });

      const created = await owner.client.post('/api/groups', { name: 'Vännernas gäng' });
      expect(created.status).toBe(201);
      const groupId = created.body.group.id as string;

      const invitation = await owner.client.post(`/api/groups/${groupId}/invitations`, {
        maxUses: 2,
        expiresInHours: 48,
      });
      expect(invitation.status).toBe(201);
      const code = invitation.body.invitation.code as string;

      const joined = await member.client.post('/api/groups/join', { code });
      expect(joined.status).toBe(201);

      const memberGoal = await createGoal(member.client, 'Medlemmens privata mål', 2_000_000);
      await deposit(member.client, memberGoal.id, 750_000);

      // Owner cannot read the member's goal or balance.
      expect((await owner.client.get(`/api/goals/${memberGoal.id}`)).status).toBe(404);
      expect((await owner.client.get(`/api/goals/${memberGoal.id}/movements`)).status).toBe(404);

      const detail = await owner.client.get(`/api/groups/${groupId}`);
      expect(detail.status).toBe(200);
      expect(detail.body.members.map((m: { alias: string }) => m.alias).sort()).toEqual(['grupp_agare', 'grupp_medlem']);
      const serialized = JSON.stringify(detail.body);
      expect(serialized).not.toMatch(/balance|target|amount|transaction|750000|2000000/i);
      expect(serialized).not.toContain('Medlemmens privata mål');

      // The member sees the same restricted projection.
      const memberView = await member.client.get(`/api/groups/${groupId}`);
      expect(memberView.status).toBe(200);
      expect(JSON.stringify(memberView.body)).not.toMatch(/balance|750000/i);
      expect(memberView.body.invitations).toEqual([]); // invitations are owner-only
    } finally {
      harness.close();
    }
  });
});

describe('4. Public leaderboards never expose private financial fields', () => {
  it('returns only alias, rank, score, class and approved badge', async () => {
    const harness = createHarness();
    try {
      const alice = await signup(harness.app, 'la@example.com', { alias: 'topp_alice' });
      const bob = await signup(harness.app, 'lb@example.com', { alias: 'topp_bob' });
      await alice.client.patch('/api/profile', { publicCompetitionConsent: true, shareBadges: true });
      await bob.client.patch('/api/profile', { publicCompetitionConsent: true });

      const aliceGoal = await createGoal(alice.client, 'Hemlig semester', 500_000);
      const bobGoal = await createGoal(bob.client, 'Bobs hemliga bil', 800_000);
      await deposit(alice.client, aliceGoal.id, 100_000);
      await deposit(bob.client, bobGoal.id, 200_000);

      const competition = harness.db
        .prepare("SELECT id FROM competitions WHERE visibility = 'public' LIMIT 1")
        .get() as { id: string } | undefined;
      const competitionId =
        competition?.id ??
        (await alice.client.get('/api/competitions')).body.public[0].id;
      syncCompetitionLifecycle(harness.db);

      expect((await alice.client.post(`/api/competitions/${competitionId}/join`, { goalId: aliceGoal.id })).status).toBe(201);
      expect((await bob.client.post(`/api/competitions/${competitionId}/join`, { goalId: bobGoal.id })).status).toBe(201);
      await deposit(alice.client, aliceGoal.id, 50_000);

      const board = await alice.client.get(`/api/competitions/${competitionId}/leaderboard`);
      expect(board.status).toBe(200);
      expect(board.body.entries.length).toBe(2);
      for (const entry of board.body.entries) {
        expect(Object.keys(entry).sort()).toEqual(['alias', 'badge', 'classCode', 'isYou', 'rank', 'score', 'scoreCenti']);
        expect(entry.alias).toMatch(/^topp_/);
      }
      const serialized = JSON.stringify(board.body);
      expect(serialized).not.toMatch(/startingBalance|lockedTarget|goalName|email|transaction/i);
      expect(serialized).not.toContain('Hemlig semester');
      expect(serialized).not.toContain('Bobs hemliga bil');
      expect(serialized).not.toContain('la@example.com');
      expect(serialized).not.toContain('lb@example.com');

      // Badges are opt-in: alice allowed it, bob did not.
      const aliceEntry = board.body.entries.find((entry: { isYou: boolean }) => entry.isYou);
      const bobEntry = board.body.entries.find((entry: { isYou: boolean }) => !entry.isYou);
      expect(aliceEntry.badge).toBeTruthy();
      expect(bobEntry.badge).toBeNull();

      // Discovery endpoints expose no finances either.
      const discovery = await bob.client.get('/api/competitions');
      expect(JSON.stringify(discovery.body)).not.toMatch(/balance|target|email|Hemlig/i);
    } finally {
      harness.close();
    }
  });
});
