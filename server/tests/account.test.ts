import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { client as testClient, createGoal, createHarness, deposit, signup, tokenFor } from './helpers.js';
import { setTestClock } from '../src/lib/time.js';

const FIXED_NOW = Date.parse('2026-08-20T11:15:00.000Z');

beforeEach(() => setTestClock(FIXED_NOW));
afterAll(() => setTestClock(null));

describe('17. Account deletion follows the documented data-deletion policy', () => {
  it('requires re-authentication and deletes all personal and financial data', async () => {
    const harness = await createHarness();
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

      // Wrong confirmation, a missing token and a token for another account are all rejected.
      expect(
        (await leaver.client.del('/api/profile/account', {
          confirmation: 'NEJ',
          accessToken: tokenFor('delete-me@example.com'),
        })).status,
      ).toBe(422);
      expect((await leaver.client.del('/api/profile/account', { confirmation: 'RADERA' })).status).toBe(422);
      expect(
        (await leaver.client.del('/api/profile/account', {
          confirmation: 'RADERA',
          accessToken: tokenFor('friend@example.com'),
        })).status,
      ).toBe(403);
      expect(await harness.db.prepare('SELECT COUNT(*) as count FROM users WHERE id = ?').get(userId)).toEqual({ count: 1 });

      const deletion = await leaver.client.del('/api/profile/account', {
        confirmation: 'RADERA',
        accessToken: tokenFor('delete-me@example.com'),
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
        ['group_members', 'user_id'],
        ['competition_participants', 'user_id'],
      ] as const) {
        const row = await harness.db.prepare(`SELECT COUNT(*)::int AS count FROM ${table} WHERE ${column} = ?`).get(userId) as {
          count: number;
        };
        expect(row.count, `${table} should be empty for the deleted user`).toBe(0);
      }

      // The group survives, ownership is transferred to the remaining member.
      const transferred = await harness.db.prepare('SELECT owner_id FROM private_groups WHERE id = ?').get(groupId) as {
        owner_id: string;
      };
      expect(transferred.owner_id).toBe(friend.user.id);

      // The session is dead and the account can no longer log in.
      const me = await leaver.client.get('/api/auth/me');
      expect(me.body.authenticated).toBe(false);
      expect((await leaver.client.get('/api/goals')).status).toBe(401);
      // The CSRF cookie was cleared with the session, so a fresh anonymous token is required.
      await leaver.client.init();
      const reLogin = await leaver.client.post('/api/auth/session', {
        accessToken: 'test:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:delete-me@example.com',
      });
      expect(reLogin.status).toBe(201);
      expect(reLogin.body.user.email).toBe('delete-me@example.com');

      // The audit log keeps a pseudonymous event without e-mail or alias.
      const auditRows = await harness.db.prepare("SELECT actor_user_id, metadata FROM audit_events WHERE event = 'account.deleted'")
        .all() as Array<{ actor_user_id: string; metadata: string }>;
      expect(auditRows.length).toBe(1);
      // Only the random UUID survives as a pseudonymous reference.
      expect(auditRows[0]!.actor_user_id).toBe(userId);
      expect(JSON.stringify(auditRows[0]!.metadata)).not.toContain('delete-me@example.com');
      expect(JSON.stringify(auditRows[0]!.metadata)).not.toContain('raderas_snart');
      const policyRows = await harness.db.prepare("SELECT metadata FROM audit_events WHERE event = 'account.deletion_policy_applied'")
        .all() as Array<{ metadata: string }>;
      expect(policyRows.length).toBe(1);
      expect(JSON.stringify(policyRows[0]!.metadata)).toContain(userId);
    } finally {
      await harness.close();
    }
  });

  it('removes the user from competition leaderboards', async () => {
    const harness = await createHarness();
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
        confirmation: 'RADERA',
        accessToken: tokenFor('gone@example.com'),
      });
      expect(deletion.status).toBe(200);

      const other = await signup(harness.app, 'watcher@example.com', { alias: 'tittar_pa' });
      const after = await other.client.get(`/api/competitions/${competitionId}/leaderboard`);
      expect(after.body.entries).toEqual([]);
      expect(JSON.stringify(after.body)).not.toContain('borta_alice');
    } finally {
      await harness.close();
    }
  });
});
