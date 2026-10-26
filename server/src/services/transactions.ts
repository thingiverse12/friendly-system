import type { Db } from '../db.js';
import { badRequest, notFound } from '../lib/errors.js';
import { uuid } from '../lib/ids.js';
import { nowIso, nowMs } from '../lib/time.js';
import { ALL_CATEGORIES, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../lib/validation.js';

export interface TransactionRow {
  id: string;
  owner_id: string;
  goal_id: string | null;
  type: 'income' | 'expense';
  amount_ore: number;
  category: string;
  description: string | null;
  occurred_at: string;
  created_at: string;
  updated_at: string;
}

export interface TransactionView {
  id: string;
  type: 'income' | 'expense';
  amountOre: number;
  category: string;
  description: string | null;
  goalId: string | null;
  goalName: string | null;
  occurredAt: string;
  createdAt: string;
}

const SELECT = `
  SELECT t.id, t.type, t.amount_ore AS "amountOre", t.category, t.description,
         t.goal_id AS "goalId", g.name AS "goalName", t.occurred_at AS "occurredAt", t.created_at AS "createdAt"
  FROM transactions t LEFT JOIN savings_goals g ON g.id = t.goal_id AND g.owner_id = t.owner_id`;

export async function categoriesFor(type: 'income' | 'expense'): Promise<readonly string[]>{
  return type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

export async function assertCategory(type: 'income' | 'expense', category: string): Promise<void>{
  if (!(ALL_CATEGORIES as readonly string[]).includes(category)) {
    throw badRequest(`Okänd kategori: ${category}`);
  }
  if (!(await categoriesFor(type)).includes(category)) {
    throw badRequest(`Kategorin ${category} passar inte för ${type === 'income' ? 'inkomst' : 'utgift'}.`);
  }
}

export interface ListFilter {
  type?: 'income' | 'expense' | undefined;
  category?: string | undefined;
  goalId?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  limit: number;
  offset: number;
}

export async function listTransactions(
  db: Db,
  userId: string,
  filter: ListFilter,
): Promise<{ items: TransactionView[]; total: number }> {
  const conditions = ['t.owner_id = ?'];
  const params: unknown[] = [userId];
  if (filter.type) {
    conditions.push('t.type = ?');
    params.push(filter.type);
  }
  if (filter.category) {
    conditions.push('t.category = ?');
    params.push(filter.category);
  }
  if (filter.goalId) {
    conditions.push('t.goal_id = ?');
    params.push(filter.goalId);
  }
  if (filter.from) {
    conditions.push('t.occurred_at >= ?');
    params.push(filter.from);
  }
  if (filter.to) {
    conditions.push('t.occurred_at <= ?');
    params.push(filter.to);
  }
  const where = conditions.join(' AND ');
  const total = (
    await db.prepare(`SELECT COUNT(*) AS count FROM transactions t WHERE ${where}`).get(...params) as { count: number }
  ).count;
  const items = await db
    .prepare(`${SELECT} WHERE ${where} ORDER BY t.occurred_at DESC, t.seq DESC LIMIT ? OFFSET ?`)
    .all(...params, filter.limit, filter.offset) as TransactionView[];
  return { items, total };
}

export interface CreateTransactionInput {
  type: 'income' | 'expense';
  amountOre: number;
  category: string;
  description?: string | null;
  goalId?: string | null;
  occurredAt?: string | undefined;
}

async function assertGoalOwnership(db: Db, userId: string, goalId: string | null | undefined): Promise<void>{
  if (!goalId) return;
  const row = await db.prepare('SELECT id FROM savings_goals WHERE id = ? AND owner_id = ?').get(goalId, userId);
  if (!row) throw notFound('Sparmålet hittades inte.');
}

async function assertOccurredAt(occurredAt: string): Promise<void>{
  const ms = Date.parse(occurredAt);
  if (Number.isNaN(ms)) throw badRequest('Ogiltigt datum.');
  if (ms > nowMs() + 24 * 3600_000) throw badRequest('Datumet kan inte ligga i framtiden.');
  if (ms < Date.parse('2000-01-01T00:00:00.000Z')) throw badRequest('Datumet är för tidigt.');
}

/** Income and expenses are recorded here only. Income never touches savings balances. */
export async function createTransaction(db: Db, userId: string, input: CreateTransactionInput): Promise<TransactionView>{
  await assertCategory(input.type, input.category);
  await assertGoalOwnership(db, userId, input.goalId);
  const occurredAt = input.occurredAt ?? nowIso();
  await assertOccurredAt(occurredAt);
  const id = uuid();
  const now = nowIso();
  await db.prepare(
    `INSERT INTO transactions (id, owner_id, goal_id, type, amount_ore, category, description, occurred_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    userId,
    input.goalId ?? null,
    input.type,
    input.amountOre,
    input.category,
    input.description ?? null,
    occurredAt,
    now,
    now,
  );
  return await getTransaction(db, userId, id);
}

export async function getTransaction(db: Db, userId: string, id: string): Promise<TransactionView>{
  const row = await db.prepare(`${SELECT} WHERE t.id = ? AND t.owner_id = ?`).get(id, userId) as
    | TransactionView
    | undefined;
  // 404 for other users' transactions: their existence is not disclosed.
  if (!row) throw notFound('Transaktionen hittades inte.');
  return row;
}

export interface UpdateTransactionInput {
  type?: 'income' | 'expense' | undefined;
  amountOre?: number | undefined;
  category?: string | undefined;
  description?: string | null | undefined;
  goalId?: string | null | undefined;
  occurredAt?: string | undefined;
}

export async function updateTransaction(
  db: Db,
  userId: string,
  id: string,
  input: UpdateTransactionInput,
): Promise<TransactionView>{
  return await db.tx(async () => {
    const existing = await db.prepare('SELECT * FROM transactions WHERE id = ? AND owner_id = ?').get(id, userId) as
      | TransactionRow
      | undefined;
    if (!existing) throw notFound('Transaktionen hittades inte.');
    const type = input.type ?? existing.type;
    const category = input.category ?? existing.category;
    if (input.type !== undefined || input.category !== undefined) await assertCategory(type, category);
    const goalId = input.goalId === undefined ? existing.goal_id : input.goalId;
    await assertGoalOwnership(db, userId, goalId);
    const occurredAt = input.occurredAt ?? existing.occurred_at;
    if (input.occurredAt) await assertOccurredAt(occurredAt);
    await db.prepare(
      `UPDATE transactions SET goal_id = ?, type = ?, amount_ore = ?, category = ?, description = ?,
        occurred_at = ?, updated_at = ? WHERE id = ? AND owner_id = ?`,
    ).run(
      goalId,
      type,
      input.amountOre ?? existing.amount_ore,
      category,
      input.description === undefined ? existing.description : input.description,
      occurredAt,
      nowIso(),
      id,
      userId,
    );
    return await getTransaction(db, userId, id);
  });
}

export async function deleteTransaction(db: Db, userId: string, id: string): Promise<void>{
  const result = await db.prepare('DELETE FROM transactions WHERE id = ? AND owner_id = ?').run(id, userId);
  if (result === 0) throw notFound('Transaktionen hittades inte.');
}

export interface MonthlySummary {
  incomeOre: number;
  expenseOre: number;
  netOre: number;
  byCategory: Array<{ category: string; type: 'income' | 'expense'; totalOre: number }>;
}

export async function monthlySummary(db: Db, userId: string, from: string, to: string): Promise<MonthlySummary>{
  const totals = await db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'income' THEN amount_ore ELSE 0 END), 0) AS income,
         COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_ore ELSE 0 END), 0) AS expense
       FROM transactions WHERE owner_id = ? AND occurred_at >= ? AND occurred_at <= ?`,
    )
    .get(userId, from, to) as { income: number; expense: number };
  const byCategory = await db
    .prepare(
      `SELECT category, type, SUM(amount_ore) AS "totalOre" FROM transactions
       WHERE owner_id = ? AND occurred_at >= ? AND occurred_at <= ?
       GROUP BY category, type ORDER BY "totalOre" DESC`,
    )
    .all(userId, from, to) as Array<{ category: string; type: 'income' | 'expense'; totalOre: number }>;
  return {
    incomeOre: totals.income,
    expenseOre: totals.expense,
    netOre: totals.income - totals.expense,
    byCategory,
  };
}
