import { Router } from 'express';
import { z } from 'zod';
import type { Db } from '../db.js';
import { currentUserId, requireAuth, param } from '../lib/http.js';
import { amountOreSchema, isoDateSchema, parseBody, parseQuery, ALL_CATEGORIES } from '../lib/validation.js';
import {
  createTransaction,
  deleteTransaction,
  getTransaction,
  listTransactions,
  monthlySummary,
  updateTransaction,
} from '../services/transactions.js';
import { nowIso } from '../lib/time.js';

const categorySchema = z.enum(ALL_CATEGORIES as unknown as [string, ...string[]]);

const createSchema = z.object({
  type: z.enum(['income', 'expense']),
  amountOre: amountOreSchema,
  category: categorySchema,
  description: z.string().trim().max(280).optional(),
  goalId: z.uuid().optional().nullable(),
  occurredAt: isoDateSchema.optional(),
});

const updateSchema = z
  .object({
    type: z.enum(['income', 'expense']).optional(),
    amountOre: amountOreSchema.optional(),
    category: categorySchema.optional(),
    description: z.string().trim().max(280).nullable().optional(),
    goalId: z.uuid().nullable().optional(),
    occurredAt: isoDateSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Inget att uppdatera.');

const listQuerySchema = z.object({
  type: z.enum(['income', 'expense']).optional(),
  category: z.string().max(40).optional(),
  goalId: z.uuid().optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
});

const summaryQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Ange månad som ÅÅÅÅ-MM.')
    .optional(),
});

export function transactionRoutes(db: Db): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/', async (req, res) => {
    const userId = currentUserId(res);
    const query = parseQuery(listQuerySchema, req.query);
    const result = await listTransactions(db, userId, {
      type: query.type,
      category: query.category,
      goalId: query.goalId,
      from: query.from,
      to: query.to,
      limit: query.limit,
      offset: query.offset,
    });
    res.json(result);
  });

  router.get('/summary', async (req, res) => {
    const userId = currentUserId(res);
    const query = parseQuery(summaryQuerySchema, req.query);
    const reference = query.month ? `${query.month}-01T00:00:00.000Z` : nowIso();
    const date = new Date(reference);
    const from = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString();
    const to = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)).toISOString();
    res.json({ month: from.slice(0, 7), ...monthlySummary(db, userId, from, to) });
  });

  router.get('/categories', async (req, res) => {
    res.json({ categories: ALL_CATEGORIES });
  });

  router.post('/', async (req, res) => {
    const userId = currentUserId(res);
    const input = parseBody(createSchema, req.body);
    const transaction = await createTransaction(db, userId, {
      type: input.type,
      amountOre: input.amountOre,
      category: input.category,
      description: input.description ?? null,
      goalId: input.goalId ?? null,
      occurredAt: input.occurredAt,
    });
    res.status(201).json({ transaction });
  });

  router.get('/:transactionId', async (req, res) => {
    const userId = currentUserId(res);
    res.json({ transaction: await getTransaction(db, userId, param(req, 'transactionId')) });
  });

  router.patch('/:transactionId', async (req, res) => {
    const userId = currentUserId(res);
    const input = parseBody(updateSchema, req.body);
    const transaction = await updateTransaction(db, userId, param(req, 'transactionId'), input);
    res.json({ transaction });
  });

  router.delete('/:transactionId', async (req, res) => {
    const userId = currentUserId(res);
    await deleteTransaction(db, userId, param(req, 'transactionId'));
    res.json({ ok: true });
  });

  return router;
}
