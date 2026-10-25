import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createGoal, createHarness, deposit, signup } from './helpers.js';
import { setTestClock } from '../src/lib/time.js';

const FIXED_NOW = Date.parse('2026-08-20T11:15:00.000Z');

beforeEach(() => setTestClock(FIXED_NOW));
afterAll(() => setTestClock(null));

describe('17. Account deletion follows the documented data-deletion policy', () => {
  it('requires password confirmation and deletes all personal and financial data', async () => {
    const harness = createHarness();
    try {
      const leaver = await signup(harness.app, 'delete-me@example.com', { alias: 'raderas_snart' });
      const friend = await signup(harness.app, 'friend@example.com', { alias: 'van_kvar' });

      // Financial data, an achievement, a group with two members, and a transaction.
      const goal = await createGoal(leaver.client, 'Ska raderas', 500_000);
      await deposit(leaver.client, goal.id, 200_000);
      await leaver.client.post('/api/transactions', { type: 'income', amountOre: 100_000, category: 'Lön' });
      const group = await leaver.client.post('/api/groups', { name: 'Kvarlevande grupp' });
      const groupId = group.body.group.id as string;
      const invitation = await leaver.client.post(`/api/groups/${groupId}/invitations`, { maxUses: 1, expiresInHours: 24 });
      await friend.client.post('/api/groups/join', { code: invitation.body.invitation.code });

      const userId = leaver.user.id as string;

      // Wrong password and wrong confirmation are rejected.
      expect((await leaver.client.del('/api/profile/account', { password: 'Fel12345678', confirmation: 'RADERA' })).status).toBe(403);
      expect((await leaver.client.del('/api/profile/account', { password: 'Lösenord12345', confirmation: 'NEJ' })).status).toBe(422);
      expect(harness.db.prepare('SELECT COUNT(*) AS count FROM users WHERE id = ?').get(userId)).toEqual({ count: 1 });

      const deletion = await leaver.client.del('/api/profile/account', {
        password: 'Lösenord12345',
        confirmation: 'RADERA',
      });
      expect(deletion.status).toBe(200);

      // All personal and financial rows are gone.
      for (const [table, column] of [
        ['users', 'id'],
        ['profiles', 'user_id'],
        ['savings_goals', 'owner_id'],
        ['transactions', 'owner_id'],
        ['savings_movements', 'owner_id'],
        ['user_achievements', 'user_id'],
        ['sessions', 'user_id'],
        ['password_reset_tokens', 'user_id'],
        ['group_members', 'user_id'],
        ['competition_participants', 'user_id'],
      ] as const) {
        const row = harness.db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE ${column} = ?`).get(userId) as {
          count: number;
        };
        expect(row.count, `${table} should be empty for the deleted user`).toBe(0);
      }

      // The group survives, ownership is transferred to the remaining member.
      const transferred = harness.db.prepare('SELECT owner_id FROM private_groups WHERE id = ?').get(groupId) as {
        owner_id: string;
      };
      expect(transferred.owner_id).toBe(friend.user.id);

      // The session is dead and the account can no longer log in.
      const me = await leaver.client.get('/api/auth/me');
      expect(me.body.authenticated).toBe(false);
      expect((await leaver.client.get('/api/goals')).status).toBe(401);
      // The CSRF cookie was cleared with the session, so a fresh anonymous token is required.
      await leaver.client.init();
      const login = await leaver.client.post('/api/auth/login', {
        email: 'delete-me@example.com',
        password: 'Lösenord12345',
      });
      expect(login.status).toBe(401);
      const reRegister = await leaver.client.post('/api/auth/register', {
        email: 'delete-me@example.com',
        password: 'Lösenord12345',
        acceptedTerms: true,
      });
      expect(reRegister.status).toBe(201);

      // The audit log keeps a pseudonymous event without e-mail or alias.
      const auditRows = harness.db
        .prepare("SELECT actor_user_id, metadata FROM audit_events WHERE event = 'account.deleted'")
        .all() as Array<{ actor_user_id: string; metadata: string }>;
      expect(auditRows.length).toBe(1);
      // Only the random UUID survives as a pseudonymous reference.
      expect(auditRows[0]!.actor_user_id).toBe(userId);
      expect(auditRows[0]!.metadata).not.toContain('delete-me@example.com');
      expect(auditRows[0]!.metadata).not.toContain('raderas_snart');
      const policyRows = harness.db
        .prepare("SELECT metadata FROM audit_events WHERE event = 'account.deletion_policy_applied'")
        .all() as Array<{ metadata: string }>;
      expect(policyRows.length).toBe(1);
      expect(policyRows[0]!.metadata).toContain(userId);
    } finally {
      harness.close();
    }
  });

  it('removes the user from competition leaderboards', async () => {
    const harness = createHarness();
    try {
      const alice = await signup(harness.app, 'gone@example.com', { alias: 'borta_alice' });
      await alice.client.patch('/api/profile', { publicCompetitionConsent: true });
      const goal = await createGoal(alice.client, 'Tävlingsmål', 500_000);
      await deposit(alice.client, goal.id, 100_000);

      const competitionId = (await alice.client.get('/api/competitions')).body.public[0].id as string;
      expect((await alice.client.post(`/api/competitions/${competitionId}/join`, { goalId: goal.id })).status).toBe(201);
      const before = await alice.client.get(`/api/competitions/${competitionId}/leaderboard`);
      expect(before.body.entries.length).toBe(1);

      const deletion = await alice.client.del('/api/profile/account', {
        password: 'Lösenord12345',
        confirmation: 'RADERA',
      });
      expect(deletion.status).toBe(200);

      const other = await signup(harness.app, 'watcher@example.com', { alias: 'tittar_pa' });
      const after = await other.client.get(`/api/competitions/${competitionId}/leaderboard`);
      expect(after.body.entries).toEqual([]);
      expect(JSON.stringify(after.body)).not.toContain('borta_alice');
    } finally {
      harness.close();
    }
  });
});
