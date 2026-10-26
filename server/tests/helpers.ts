import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createPgliteDatabase, migrate, type Db } from '../src/db.js';
import { createTestAuthProvider } from '../src/services/supabase.js';
import { sha256 } from '../src/lib/ids.js';

export interface Harness {
  db: Db;
  app: Express;
  close: () => Promise<void>;
}

let counter = 0;

/**
 * Tests run against PGlite: the real Postgres engine, in-process. The same migrations and the same
 * SQL as Supabase, so schema rules (FK/CHECK/triggers) are exercised for real.
 */
export async function createHarness(): Promise<Harness> {
  const db = await createPgliteDatabase('memory://');
  await migrate(db);
  const app = createApp(db, createTestAuthProvider());
  return {
    db,
    app,
    close: async () => {
      await db.close();
    },
  };
}

/** Deterministic Supabase-style user id per e-mail, so register/login describe the same identity. */
export function identityFor(email: string): string {
  const hex = sha256(email.toLowerCase());
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function tokenFor(email: string): string {
  return `test:${identityFor(email)}:${email.toLowerCase()}`;
}

export interface TestClient {
  agent: request.Agent;
  csrf: string;
  ip: string;
  init: () => Promise<TestClient>;
  /** Signs in through the Supabase token exchange (the only login path in the app). */
  register: (email: string, extra?: Record<string, unknown>, password?: string) => Promise<any>;
  login: (email: string, password?: string) => Promise<any>;
  get: (url: string) => request.Test;
  post: (url: string, body?: unknown) => request.Test;
  patch: (url: string, body?: unknown) => request.Test;
  del: (url: string, body?: unknown) => request.Test;
}

/** Supertest client that keeps cookies and echoes the CSRF token, like the SPA does. */
export function client(app: Express): TestClient {
  const agent = request.agent(app);
  const ip = `10.10.${(counter % 200) + 1}.${(counter % 250) + 1}`;
  const withIp = <T extends request.Test>(test: T): T => test.set('x-forwarded-for', ip);

  const exchange = async (email: string, extra: Record<string, unknown>) => {
    const response = await withIp(agent.post('/api/auth/session'))
      .set('x-csrf-token', api.csrf)
      .send({ accessToken: tokenFor(email), ...extra });
    if (response.status !== 200 && response.status !== 201) {
      throw new Error(`session exchange failed: ${response.status} ${JSON.stringify(response.body)}`);
    }
    api.csrf = response.body.csrfToken;
    return response.body.user;
  };

  const api: TestClient = {
    agent,
    csrf: '',
    ip,
    async init() {
      const response = await withIp(agent.get('/api/auth/csrf'));
      api.csrf = response.body.csrfToken;
      return api;
    },
    async register(email, extra = {}) {
      return exchange(email, extra);
    },
    async login(email) {
      return exchange(email, {});
    },
    get(url) {
      return withIp(agent.get(url));
    },
    post(url, body) {
      return withIp(agent.post(url)).set('x-csrf-token', api.csrf).send(body);
    },
    patch(url, body) {
      return withIp(agent.patch(url)).set('x-csrf-token', api.csrf).send(body);
    },
    del(url, body) {
      return withIp(agent.delete(url)).set('x-csrf-token', api.csrf).send(body);
    },
  };
  return api;
}

export async function signup(
  app: Express,
  email: string,
  extra: Record<string, unknown> = {},
): Promise<{ client: TestClient; user: any }> {
  const api = await client(app).init();
  const user = await api.register(email, extra);
  return { client: api, user };
}

export async function createGoal(api: TestClient, name: string, targetAmountOre: number): Promise<any> {
  const response = await api.post('/api/goals', { name, targetAmountOre });
  if (response.status !== 201) throw new Error(`goal failed ${response.status} ${JSON.stringify(response.body)}`);
  return response.body.goal;
}

export async function deposit(api: TestClient, goalId: string, amountOre: number): Promise<any> {
  const response = await api.post(`/api/goals/${goalId}/movements`, { type: 'deposit', amountOre });
  if (response.status !== 201) throw new Error(`deposit failed ${response.status} ${JSON.stringify(response.body)}`);
  return response.body;
}

export const DAY = 24 * 60 * 60 * 1000;
