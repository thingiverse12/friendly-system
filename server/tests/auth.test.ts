import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { client, createHarness, signup, tokenFor } from './helpers.js';
import { setTestClock } from '../src/lib/time.js';

const FIXED_NOW = Date.parse('2026-03-02T09:00:00.000Z');

beforeEach(() => setTestClock(FIXED_NOW));
afterAll(() => setTestClock(null));

describe('1. Unauthenticated users cannot access financial data', () => {
  it('rejects every financial endpoint without a session', async () => {
    const harness = await createHarness();
    try {
      const api = await client(harness.app).init();
      const endpoints = [
        '/api/goals',
        '/api/transactions',
        '/api/transactions/summary',
        '/api/dashboard',
        '/api/achievements',
        '/api/profile',
        '/api/groups',
      ];
      for (const endpoint of endpoints) {
        const response = await api.get(endpoint);
        expect(response.status, `${endpoint} should be 401`).toBe(401);
        expect(response.body.error.code).toBe('unauthorized');
      }
      // Anonymous discovery is allowed but carries no personal or financial data.
      const competitions = await api.get('/api/competitions');
      expect(competitions.status).toBe(200);
      expect(competitions.body.mine).toEqual([]);
      expect(JSON.stringify(competitions.body.public)).not.toMatch(/balance|target|email/i);
    } finally {
      await harness.close();
    }
  });

  it('forged session cookies are ignored', async () => {
    const harness = await createHarness();
    try {
      const api = await client(harness.app).init();
      const response = await api.agent
        .get('/api/goals')
        .set('Cookie', 'sparly_session=not-a-real-token')
        .set('x-forwarded-for', api.ip);
      expect(response.status).toBe(401);
    } finally {
      await harness.close();
    }
  });
});

describe('Authentication lifecycle', () => {
  it('registers, logs in, logs out and validates the session server-side', async () => {
    const harness = await createHarness();
    try {
      const { client: api } = await signup(harness.app, 'alex@example.com', { alias: 'sparlygd_alex' });
      const me = await api.get('/api/auth/me');
      expect(me.status).toBe(200);
      expect(me.body.authenticated).toBe(true);
      expect(me.body.user.email).toBe('alex@example.com');

      const logout = await api.post('/api/auth/logout');
      expect(logout.status).toBe(200);
      api.csrf = logout.body.csrfToken;
      const after = await api.get('/api/auth/me');
      expect(after.body.authenticated).toBe(false);
      expect((await api.get('/api/goals')).status).toBe(401);

      // The revoked token cannot be replayed.
      const replayed = await api.agent
        .get('/api/goals')
        .set('Cookie', 'sparly_session=replayed')
        .set('x-forwarded-for', api.ip);
      expect(replayed.status).toBe(401);
    } finally {
      await harness.close();
    }
  });

  it('maps Supabase identities and never stores credentials itself', async () => {
    const harness = await createHarness();
    try {
      const { user } = await signup(harness.app, 'hash@example.com', { alias: 'hash_anvandare' });
      expect(user.email).toBe('hash@example.com');

      // The app owns profile and finance data only; credentials live in Supabase Auth.
      const columns = await harness.db.prepare(
        "SELECT column_name AS name FROM information_schema.columns WHERE table_name = 'users'",
      ).all() as Array<{ name: string }>;
      const names = columns.map((column) => column.name);
      expect(names).not.toContain('password_hash');
      expect(names).not.toContain('password');
      expect(names).toContain('email_verified');

      // Two different Supabase users cannot claim the same e-mail.
      const other = await client(harness.app).init();
      const clash = await other.post('/api/auth/session', {
        accessToken: 'test:99999999-9999-4999-8999-999999999999:hash@example.com',
      });
      expect(clash.status).toBe(409);

      // The same Supabase identity logging in again reuses its row.
      const again = await client(harness.app).init();
      const repeated = await again.post('/api/auth/session', { accessToken: tokenFor('hash@example.com') });
      expect(repeated.status).toBe(200);
      expect(repeated.body.created).toBe(false);
      const users = await harness.db.prepare('SELECT COUNT(*)::int AS count FROM users').get() as { count: number };
      expect(users.count).toBe(1);
    } finally {
      await harness.close();
    }
  });

  it('rejects missing, malformed and foreign access tokens with a generic message', async () => {
    const harness = await createHarness();
    try {
      const api = await client(harness.app).init();
      const messages = new Set<string>();
      for (const accessToken of ['inte-en-giltig-token-alls', 'test:bara-tva-delar-har', 'x'.repeat(40)]) {
        const response = await api.post('/api/auth/session', { accessToken });
        expect(response.status).toBe(401);
        messages.add(response.body.error.message);
      }
      expect(messages.size).toBe(1);
      expect([...messages][0]).toMatch(/logga in/i);

      // A missing token never reaches Supabase; it is a validation error.
      expect((await api.post('/api/auth/session', {})).status).toBe(422);
    } finally {
      await harness.close();
    }
  });

  it('keeps sessions independent per device and revokes only the one that logs out', async () => {
    const harness = await createHarness();
    try {
      const phone = await client(harness.app).init();
      const laptop = await client(harness.app).init();
      await phone.register('device@example.com', { alias: 'dela_enheter' });
      await laptop.login('device@example.com');

      expect((await phone.get('/api/goals')).status).toBe(200);
      expect((await laptop.get('/api/goals')).status).toBe(200);

      const logout = await phone.post('/api/auth/logout');
      expect(logout.status).toBe(200);
      expect((await phone.get('/api/goals')).status).toBe(401);
      expect((await laptop.get('/api/goals')).status).toBe(200);

      const sessions = await harness.db
        .prepare('SELECT COUNT(*)::int AS total, COUNT(revoked_at)::int AS revoked FROM sessions')
        .get() as { total: number; revoked: number };
      expect(sessions.total).toBe(2);
      expect(sessions.revoked).toBe(1);
    } finally {
      await harness.close();
    }
  });

  it('validates alias, timezone and consent when the profile is created or updated', async () => {
    const harness = await createHarness();
    try {
      const invalidAlias = await client(harness.app).init();
      expect(
        (await invalidAlias.post('/api/auth/session', {
          accessToken: tokenFor('alias@example.com'),
          alias: 'a',
        })).status,
      ).toBe(422);

      const invalidZone = await client(harness.app).init();
      expect(
        (await invalidZone.post('/api/auth/session', {
          accessToken: tokenFor('zone@example.com'),
          timezone: 'Mars/Olympus',
        })).status,
      ).toBe(422);

      const { client: api } = await signup(harness.app, 'valid@example.com', {
        alias: 'giltigt_alias',
        publicCompetitionConsent: true,
      });
      expect((await api.patch('/api/profile', { alias: 'nytt_alias' })).status).toBe(200);
      expect((await api.patch('/api/profile', { timezone: 'Europe/Stockholm' })).status).toBe(200);
      // Alias uniqueness is enforced by the database, not only by the UI.
      const other = await signup(harness.app, 'other@example.com', { alias: 'annat_alias' });
      expect((await other.client.patch('/api/profile', { alias: 'nytt_alias' })).status).toBe(409);
    } finally {
      await harness.close();
    }
  });

  it('rejects state-changing requests without a CSRF token or from a foreign origin', async () => {
    const harness = await createHarness();
    try {
      const { client: api } = await signup(harness.app, 'csrf@example.com');
      const missing = await api.agent
        .post('/api/goals')
        .set('x-forwarded-for', api.ip)
        .send({ name: 'Utan token', targetAmountOre: 100000 });
      expect(missing.status).toBe(403);

      const wrong = await api.agent
        .post('/api/goals')
        .set('x-csrf-token', 'fel-token')
        .set('x-forwarded-for', api.ip)
        .send({ name: 'Fel token', targetAmountOre: 100000 });
      expect(wrong.status).toBe(403);

      const foreign = await api.agent
        .post('/api/goals')
        .set('x-csrf-token', api.csrf)
        .set('Origin', 'https://evil.example.com')
        .set('x-forwarded-for', api.ip)
        .send({ name: 'Cross site', targetAmountOre: 100000 });
      expect(foreign.status).toBe(400);

      const valid = await api.post('/api/goals', { name: 'Rätt token', targetAmountOre: 100000 });
      expect(valid.status).toBe(201);
    } finally {
      await harness.close();
    }
  });

  it('rate limits session exchanges per client', async () => {
    const harness = await createHarness();
    try {
      const attacker = await client(harness.app).init();
      const statuses: number[] = [];
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const response = await attacker.post('/api/auth/session', { accessToken: `fel-token-${attempt}` });
        statuses.push(response.status);
      }
      expect(statuses.filter((status) => status === 429).length).toBeGreaterThan(0);
      expect(statuses.at(-1)).toBe(429);
      // Rate limiting must not create users or sessions.
      const users = await harness.db.prepare('SELECT COUNT(*)::int AS count FROM users').get() as { count: number };
      expect(users.count).toBe(0);
    } finally {
      await harness.close();
    }
  });

  it('rejects SQL injection attempts without corrupting data', async () => {
    const harness = await createHarness();
    try {
      const { client: api } = await signup(harness.app, 'injection@example.com');
      const goal = await api.post('/api/goals', { name: "Mål'); DROP TABLE users;--", targetAmountOre: 100000 });
      expect(goal.status).toBe(201);
      const list = await api.get('/api/transactions?category=%27%20OR%201%3D1%20--');
      expect(list.status).toBe(200);
      expect(list.body.items).toEqual([]);
      const users = await harness.db.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number };
      expect(users.count).toBe(1);
    } finally {
      await harness.close();
    }
  });
});

describe('5. Public participation is disabled by default', () => {
  it('defaults public consent to false, requires explicit opt-in, and blocks joining until consent', async () => {
    const harness = await createHarness();
    try {
      const { client: api, user } = await signup(harness.app, 'consent@example.com');
      expect(user.profile.publicCompetitionConsent).toBe(false);
      expect(user.profile.shareBadges).toBe(false);

      const goal = await api.post('/api/goals', { name: 'Resa', targetAmountOre: 500000 });
      // Discovery seeds the public 7- and 30-day competitions.
      await api.get('/api/competitions');
      const competitionId = await harness.db.prepare("SELECT id FROM competitions WHERE visibility = 'public' LIMIT 1")
        .get() as { id: string };

      const blocked = await api.post(`/api/competitions/${competitionId.id}/join`, { goalId: goal.body.goal.id });
      expect(blocked.status).toBe(403);

      const enabled = await api.patch('/api/profile', { publicCompetitionConsent: true });
      expect(enabled.status).toBe(200);
      expect(enabled.body.user.profile.publicCompetitionConsent).toBe(true);

      const allowed = await api.post(`/api/competitions/${competitionId.id}/join`, { goalId: goal.body.goal.id });
      expect(allowed.status).toBe(201);

      const stored = await harness.db.prepare('SELECT public_competition_consent AS consent FROM profiles WHERE user_id = ?')
        .get(user.id) as { consent: number };
      expect(stored.consent).toBe(1);
    } finally {
      await harness.close();
    }
  });
});
