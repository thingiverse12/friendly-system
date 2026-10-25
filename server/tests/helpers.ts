import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { openDatabase, type Db } from '../src/db.js';

export interface Harness {
  db: Db;
  app: Express;
  file: string | null;
  close: () => void;
}

let counter = 0;

export function createHarness(options: { file?: boolean } = {}): Harness {
  if (options.file) {
    const file = path.join(os.tmpdir(), `sparly-test-${process.pid}-${(counter += 1)}-${Date.now()}.db`);
    const db = openDatabase(file);
    return {
      db,
      app: createApp(db),
      file,
      close: () => {
        db.close();
        for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${file}${suffix}`, { force: true });
      },
    };
  }
  const db = openDatabase(':memory:');
  return { db, app: createApp(db), file: null, close: () => db.close() };
}

export interface TestClient {
  agent: request.Agent;
  csrf: string;
  ip: string;
  init: () => Promise<TestClient>;
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
  const api: TestClient = {
    agent,
    csrf: '',
    ip,
    async init() {
      const response = await withIp(agent.get('/api/auth/csrf'));
      api.csrf = response.body.csrfToken;
      return api;
    },
    async register(email, extra = {}, password = 'Lösenord12345') {
      const response = await withIp(agent.post('/api/auth/register'))
        .set('x-csrf-token', api.csrf)
        .send({ email, password, acceptedTerms: true, ...extra });
      if (response.status !== 201) {
        throw new Error(`register failed: ${response.status} ${JSON.stringify(response.body)}`);
      }
      api.csrf = response.body.csrfToken;
      return response.body.user;
    },
    async login(email, password = 'Lösenord12345') {
      const response = await withIp(agent.post('/api/auth/login'))
        .set('x-csrf-token', api.csrf)
        .send({ email, password });
      if (response.status !== 200) {
        throw new Error(`login failed: ${response.status} ${JSON.stringify(response.body)}`);
      }
      api.csrf = response.body.csrfToken;
      return response.body.user;
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

export async function createGoal(
  api: TestClient,
  name: string,
  targetAmountOre: number,
): Promise<any> {
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
