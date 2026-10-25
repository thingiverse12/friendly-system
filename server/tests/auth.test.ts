import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { client, createHarness, signup } from './helpers.js';
import { setTestClock } from '../src/lib/time.js';

const FIXED_NOW = Date.parse('2026-03-02T09:00:00.000Z');

beforeEach(() => setTestClock(FIXED_NOW));
afterAll(() => setTestClock(null));

describe('1. Unauthenticated users cannot access financial data', () => {
  it('rejects every financial endpoint without a session', async () => {
    const harness = createHarness();
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
      harness.close();
    }
  });

  it('forged session cookies are ignored', async () => {
    const harness = createHarness();
    try {
      const api = await client(harness.app).init();
      const response = await api.agent
        .get('/api/goals')
        .set('Cookie', 'sparly_session=not-a-real-token')
        .set('x-forwarded-for', api.ip);
      expect(response.status).toBe(401);
    } finally {
      harness.close();
    }
  });
});

describe('Authentication lifecycle', () => {
  it('registers, logs in, logs out and validates the session server-side', async () => {
    const harness = createHarness();
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
      harness.close();
    }
  });

  it('stores Argon2id hashes and never plaintext passwords, and rejects duplicate e-mail', async () => {
    const harness = createHarness();
    try {
      await signup(harness.app, 'hash@example.com', {}, 'UniktLösenord123');
      const row = harness.db.prepare('SELECT password_hash AS hash FROM users WHERE email = ?').get('hash@example.com') as {
        hash: string;
      };
      expect(row.hash.startsWith('$argon2id$')).toBe(true);
      expect(row.hash).not.toContain('UniktLösenord123');

      const api = await client(harness.app).init();
      const duplicate = await api.post('/api/auth/register', {
        email: 'hash@example.com',
        password: 'AnnatLösenord123',
        acceptedTerms: true,
      });
      expect(duplicate.status).toBe(409);
    } finally {
      harness.close();
    }
  });

  it('rejects wrong passwords with a generic message', async () => {
    const harness = createHarness();
    try {
      await signup(harness.app, 'login@example.com');
      const api = await client(harness.app).init();
      const wrong = await api.post('/api/auth/login', { email: 'login@example.com', password: 'FelLösenord123' });
      expect(wrong.status).toBe(401);
      expect(wrong.body.error.message).toBe('E-post eller lösenord stämmer inte.');

      const unknown = await api.post('/api/auth/login', { email: 'nobody@example.com', password: 'FelLösenord123' });
      expect(unknown.status).toBe(401);
      expect(unknown.body.error.message).toBe(wrong.body.error.message);
    } finally {
      harness.close();
    }
  });

  it('completes a password reset and invalidates the old password and token', async () => {
    const harness = createHarness();
    try {
      const { client: api } = await signup(harness.app, 'reset@example.com', {}, 'GammaltLösenord123');
      const requestReset = await api.post('/api/auth/password/request', { email: 'reset@example.com' });
      expect(requestReset.status).toBe(200);
      const token = requestReset.body.devResetToken as string;
      expect(token).toBeTruthy();

      // Unknown e-mail gets the same generic answer.
      const unknown = await api.post('/api/auth/password/request', { email: 'nobody@example.com' });
      expect(unknown.status).toBe(200);
      expect(unknown.body.devResetToken).toBeUndefined();

      const reset = await api.post('/api/auth/password/reset', { token, password: 'NyttLösenord123' });
      expect(reset.status).toBe(200);

      const reuse = await api.post('/api/auth/password/reset', { token, password: 'AnnuEtt12345' });
      expect(reuse.status).toBe(400);

      const loginApi = await client(harness.app).init();
      expect((await loginApi.post('/api/auth/login', { email: 'reset@example.com', password: 'NyttLösenord123' })).status).toBe(200);
      const oldLogin = await client(harness.app).init();
      expect((await oldLogin.post('/api/auth/login', { email: 'reset@example.com', password: 'GammaltLösenord123' })).status).toBe(401);
    } finally {
      harness.close();
    }
  });

  it('rejects weak passwords and invalid e-mail addresses', async () => {
    const harness = createHarness();
    try {
      const api = await client(harness.app).init();
      for (const password of ['kort1', 'baraBokstäver', '1234567890']) {
        const response = await api.post('/api/auth/register', {
          email: `weak${Math.random()}@example.com`,
          password,
          acceptedTerms: true,
        });
        expect(response.status, password).toBe(422);
      }
      const badEmail = await api.post('/api/auth/register', {
        email: 'inte-en-epost',
        password: 'GiltigtLösenord123',
        acceptedTerms: true,
      });
      expect(badEmail.status).toBe(422);
      const noTerms = await api.post('/api/auth/register', {
        email: 'villkor@example.com',
        password: 'GiltigtLösenord123',
        acceptedTerms: false,
      });
      expect(noTerms.status).toBe(422);
    } finally {
      harness.close();
    }
  });
});

describe('CSRF and rate limiting', () => {
  it('rejects state-changing requests without a CSRF token or from a foreign origin', async () => {
    const harness = createHarness();
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
      harness.close();
    }
  });

  it('rate limits login attempts', async () => {
    const harness = createHarness();
    try {
      await signup(harness.app, 'ratelimit@example.com');
      const attacker = await client(harness.app).init();
      const statuses: number[] = [];
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const response = await attacker.post('/api/auth/login', {
          email: 'ratelimit@example.com',
          password: `Fel${attempt}Lösenord`,
        });
        statuses.push(response.status);
      }
      expect(statuses.filter((status) => status === 429).length).toBeGreaterThan(0);
      expect(statuses.at(-1)).toBe(429);
    } finally {
      harness.close();
    }
  });

  it('rejects SQL injection attempts without corrupting data', async () => {
    const harness = createHarness();
    try {
      const { client: api } = await signup(harness.app, 'injection@example.com');
      const goal = await api.post('/api/goals', { name: "Mål'); DROP TABLE users;--", targetAmountOre: 100000 });
      expect(goal.status).toBe(201);
      const list = await api.get('/api/transactions?category=%27%20OR%201%3D1%20--');
      expect(list.status).toBe(200);
      expect(list.body.items).toEqual([]);
      const users = harness.db.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number };
      expect(users.count).toBe(1);
    } finally {
      harness.close();
    }
  });
});

describe('5. Public participation is disabled by default', () => {
  it('defaults public consent to false, requires explicit opt-in, and blocks joining until consent', async () => {
    const harness = createHarness();
    try {
      const { client: api, user } = await signup(harness.app, 'consent@example.com');
      expect(user.profile.publicCompetitionConsent).toBe(false);
      expect(user.profile.shareBadges).toBe(false);

      const goal = await api.post('/api/goals', { name: 'Resa', targetAmountOre: 500000 });
      // Discovery seeds the public 7- and 30-day competitions.
      await api.get('/api/competitions');
      const competitionId = harness.db
        .prepare("SELECT id FROM competitions WHERE visibility = 'public' LIMIT 1")
        .get() as { id: string };

      const blocked = await api.post(`/api/competitions/${competitionId.id}/join`, { goalId: goal.body.goal.id });
      expect(blocked.status).toBe(403);

      const enabled = await api.patch('/api/profile', { publicCompetitionConsent: true });
      expect(enabled.status).toBe(200);
      expect(enabled.body.user.profile.publicCompetitionConsent).toBe(true);

      const allowed = await api.post(`/api/competitions/${competitionId.id}/join`, { goalId: goal.body.goal.id });
      expect(allowed.status).toBe(201);

      const stored = harness.db
        .prepare('SELECT public_competition_consent AS consent FROM profiles WHERE user_id = ?')
        .get(user.id) as { consent: number };
      expect(stored.consent).toBe(1);
    } finally {
      harness.close();
    }
  });
});
