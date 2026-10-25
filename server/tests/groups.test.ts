import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { client, createGoal, createHarness, deposit, signup } from './helpers.js';
import { advanceTestClock, setTestClock } from '../src/lib/time.js';

const FIXED_NOW = Date.parse('2026-06-15T12:00:00.000Z');

beforeEach(() => setTestClock(FIXED_NOW));
afterAll(() => setTestClock(null));

async function groupWithOwner(app: Parameters<typeof signup>[0]) {
  const owner = await signup(app, 'group-owner@example.com', { alias: 'grupp_agare' });
  const created = await owner.client.post('/api/groups', { name: 'Testgänget' });
  expect(created.status).toBe(201);
  return { owner, groupId: created.body.group.id as string };
}

describe('14. Expired and revoked invitation codes fail', () => {
  it('rejects revoked, expired and unknown codes', async () => {
    const harness = await createHarness();
    try {
      const { owner, groupId } = await groupWithOwner(harness.app);
      const guest = await signup(harness.app, 'guest@example.com', { alias: 'gast_ett' });
      const other = await signup(harness.app, 'guest2@example.com', { alias: 'gast_tva' });

      // Revoked code.
      const created = await owner.client.post(`/api/groups/${groupId}/invitations`, { maxUses: 5, expiresInHours: 48 });
      expect(created.status).toBe(201);
      const code = created.body.invitation.code as string;
      expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);

      // Only a hash is persisted.
      const stored = await harness.db.prepare('SELECT code_hash AS hash FROM invitation_codes WHERE group_id = ?')
        .get(groupId) as { hash: string };
      expect(stored.hash).not.toBe(code);
      expect(stored.hash).toMatch(/^[a-f0-9]{64}$/);
      expect(JSON.stringify(await harness.db.prepare('SELECT * FROM invitation_codes').all())).not.toContain(code.replace(/-/g, ''));

      const revoke = await owner.client.del(`/api/groups/${groupId}/invitations/${created.body.invitation.id}`);
      expect(revoke.status).toBe(200);
      const revokedJoin = await guest.client.post('/api/groups/join', { code });
      expect(revokedJoin.status).toBe(409);
      expect(revokedJoin.body.error.message).toMatch(/återkallad/i);

      // Expired code.
      const expiring = await owner.client.post(`/api/groups/${groupId}/invitations`, {
        maxUses: 5,
        expiresInHours: 1,
      });
      const expiringCode = expiring.body.invitation.code as string;
      advanceTestClock(2 * 3_600_000);
      const expiredJoin = await other.client.post('/api/groups/join', { code: expiringCode });
      expect(expiredJoin.status).toBe(409);
      expect(expiredJoin.body.error.message).toMatch(/gått ut/i);

      // Unknown and malformed codes.
      expect((await guest.client.post('/api/groups/join', { code: 'AAAA-BBBB-CCCC' })).status).toBe(404);
      expect((await guest.client.post('/api/groups/join', { code: 'kort' })).status).toBe(422);

      // Members that were never invited cannot view the group.
      expect((await guest.client.get(`/api/groups/${groupId}`)).status).toBe(403);
      // Non-owners cannot mint invitation codes.
      expect((await guest.client.post(`/api/groups/${groupId}/invitations`, { maxUses: 1 })).status).toBe(403);
    } finally {
      await harness.close();
    }
  });
});

describe('15. Invitation usage limits remain correct', () => {
  it('enforces max uses and exposes usage metadata', async () => {
    const harness = await createHarness();
    try {
      const { owner, groupId } = await groupWithOwner(harness.app);
      const invitation = await owner.client.post(`/api/groups/${groupId}/invitations`, { maxUses: 2, expiresInHours: 24 });
      const code = invitation.body.invitation.code as string;

      const users = [];
      for (let index = 1; index <= 3; index += 1) {
        const account = await signup(harness.app, `limited${index}@example.com`, { alias: `begransad_${index}` });
        users.push(account);
      }

      expect((await users[0]!.client.post('/api/groups/join', { code })).status).toBe(201);
      expect((await users[1]!.client.post('/api/groups/join', { code: code.toLowerCase() })).status).toBe(201);
      const third = await users[2]!.client.post('/api/groups/join', { code });
      expect(third.status).toBe(409);
      expect(third.body.error.message).toMatch(/maximalt/i);

      const stored = await harness.db.prepare('SELECT uses_count AS uses, max_uses AS max FROM invitation_codes WHERE group_id = ?')
        .get(groupId) as { uses: number; max: number };
      expect(stored.uses).toBe(2);
      expect(stored.uses).toBeLessThanOrEqual(stored.max);

      const members = await harness.db.prepare('SELECT COUNT(*) AS count FROM group_members WHERE group_id = ?').get(groupId) as {
        count: number;
      };
      expect(members.count).toBe(3); // owner + two successful joins

      const listed = await owner.client.get(`/api/groups/${groupId}`);
      const metadata = listed.body.invitations[0];
      expect(metadata.usesCount).toBe(2);
      expect(metadata.status).toBe('used');
      expect(JSON.stringify(metadata)).not.toContain(code);

      // The database itself refuses to exceed the limit.
      await expect(harness.db.prepare('UPDATE invitation_codes SET uses_count = max_uses + 1 WHERE group_id = ?').run(groupId),).rejects.toThrow(/check constraint/i);
    } finally {
      await harness.close();
    }
  });

  it('keeps the usage limit correct under concurrent requests', async () => {
    const harness = await createHarness();
    try {
      const { owner, groupId } = await groupWithOwner(harness.app);
      const invitation = await owner.client.post(`/api/groups/${groupId}/invitations`, {
        maxUses: 1,
        expiresInHours: 24,
      });
      const code = invitation.body.invitation.code as string;

      const first = await signup(harness.app, 'race1@example.com', { alias: 'race_ett' });
      const secondClient = await client(harness.app).init();
      await secondClient.register('race2@example.com', { alias: 'race_tva' });

      // Two independent clients race for the single remaining use.
      const [a, b] = await Promise.all([
        first.client.post('/api/groups/join', { code }),
        secondClient.post('/api/groups/join', { code }),
      ]);
      expect([a.status, b.status].sort()).toEqual([201, 409]);

      const stored = (await harness.db
        .prepare('SELECT uses_count AS uses, max_uses AS max FROM invitation_codes WHERE group_id = ?')
        .get(groupId)) as { uses: number; max: number };
      expect(stored.uses).toBe(1);
      expect(stored.max).toBe(1);
      const members = (await harness.db
        .prepare('SELECT COUNT(*)::int AS count FROM group_members WHERE group_id = ?')
        .get(groupId)) as { count: number };
      expect(members.count).toBe(2);
    } finally {
      await harness.close();
    }
  });
});

describe('Groups lifecycle', () => {
  it('transfers ownership when the owner leaves and deletes the group when empty', async () => {
    const harness = await createHarness();
    try {
      const { owner, groupId } = await groupWithOwner(harness.app);
      const guest = await signup(harness.app, 'leave@example.com', { alias: 'lamnar_grupp' });
      const invitation = await owner.client.post(`/api/groups/${groupId}/invitations`, { maxUses: 1, expiresInHours: 24 });
      await guest.client.post('/api/groups/join', { code: invitation.body.invitation.code });

      const leave = await owner.client.post(`/api/groups/${groupId}/leave`);
      expect(leave.status).toBe(200);
      expect(leave.body.newOwnerId).toBe(guest.user.id);
      const group = await harness.db.prepare('SELECT owner_id FROM private_groups WHERE id = ?').get(groupId) as {
        owner_id: string;
      };
      expect(group.owner_id).toBe(guest.user.id);

      const last = await guest.client.post(`/api/groups/${groupId}/leave`);
      expect(last.body.groupDeleted).toBe(true);
      expect(await harness.db.prepare('SELECT COUNT(*) AS count FROM private_groups WHERE id = ?').get(groupId)).toEqual({
        count: 0,
      });
    } finally {
      await harness.close();
    }
  });

  it('creates private competitions visible only to group members', async () => {
    const harness = await createHarness();
    try {
      const { owner, groupId } = await groupWithOwner(harness.app);
      const outsider = await signup(harness.app, 'outsider@example.com', { alias: 'utanfor' });
      const goal = await createGoal(owner.client, 'Gruppmål', 500_000);
      await deposit(owner.client, goal.id, 100_000);

      const competition = await owner.client.post(`/api/groups/${groupId}/competitions`, {
        name: 'Gruppens tävling',
        durationDays: 7,
        startsInHours: 0,
      });
      expect(competition.status).toBe(201);
      const competitionId = competition.body.competition.id as string;

      expect((await outsider.client.get(`/api/competitions/${competitionId}`)).status).toBe(404);
      expect((await outsider.client.post(`/api/competitions/${competitionId}/join`, { goalId: goal.id })).status).toBe(404);

      const joined = await owner.client.post(`/api/competitions/${competitionId}/join`, { goalId: goal.id });
      expect(joined.status).toBe(201);

      // Public consent is not needed for private group competitions.
      expect((await owner.client.get(`/api/competitions/${competitionId}/leaderboard`)).status).toBe(200);
      expect((await outsider.client.get('/api/competitions')).body.groups).toEqual([]);
    } finally {
      await harness.close();
    }
  });
});
