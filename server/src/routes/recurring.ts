import { Router } from 'express';
import { z } from 'zod';
import type { Db } from '../db.js';
import { currentUserId, requireAuth, param } from '../lib/http.js';
import { ALL_CATEGORIES, amountOreSchema, parseBody } from '../lib/validation.js';
import { assertCategory } from '../services/transactions.js';
import {
  createRule,
  deleteRule,
  getRule,
  listRules,
  runDueRules,
  todayForUser,
  updateRule,
} from '../services/recurring.js';

const categorySchema = z.enum(ALL_CATEGORIES as unknown as [string, ...string[]]);
const dateOnlySchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, 'Ange datum som ÅÅÅÅ-MM-DD.');
const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Ange månad som ÅÅÅÅ-MM.');

const createSchema = z.object({
  type: z.enum(['income', 'expense']),
  amountOre: amountOreSchema,
  category: categorySchema,
  description: z.string().trim().max(280).nullable().optional(),
  interval: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']),
  startDate: dateOnlySchema.optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  weekday: z.number().int().min(1).max(7).optional(),
  endMonth: monthSchema.nullable().optional(),
  active: z.boolean().optional(),
});

const updateSchema = z
  .object({
    type: z.enum(['income', 'expense']).optional(),
    amountOre: amountOreSchema.optional(),
    category: categorySchema.optional(),
    description: z.string().trim().max(280).nullable().optional(),
    interval: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']).optional(),
    startDate: dateOnlySchema.optional(),
    dayOfMonth: z.number().int().min(1).max(31).optional(),
    weekday: z.number().int().min(1).max(7).optional(),
    endMonth: monthSchema.nullable().optional(),
    active: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Inget att uppdatera.');

export function recurringRoutes(db: Db): Router {
  const router = Router();
  router.use(requireAuth);

  /**
   * Listing the rules is also what keeps them alive: every due occurrence is booked before the
   * response is built, so the app never needs a cron job or a worker to stay in sync.
   */
  router.get('/', async (_req, res) => {
    const userId = currentUserId(res);
    const today = await todayForUser(db, userId);
    const run = await runDueRules(db, userId, today);
    const result = await listRules(db, userId, today);
    res.json({ ...result, today, booked: run.booked });
  });

  router.post('/', async (req, res) => {
    const userId = currentUserId(res);
    const input = parseBody(createSchema, req.body);
    await assertCategory(input.type, input.category);
    const today = await todayForUser(db, userId);
    const rule = await createRule(db, userId, { ...input, description: input.description ?? null }, today);
    res.status(201).json({ rule });
  });

  router.get('/:ruleId', async (req, res) => {
    const userId = currentUserId(res);
    const today = await todayForUser(db, userId);
    res.json({ rule: await getRule(db, userId, param(req, 'ruleId'), today) });
  });

  router.patch('/:ruleId', async (req, res) => {
    const userId = currentUserId(res);
    const input = parseBody(updateSchema, req.body);
    if (input.type !== undefined || input.category !== undefined) {
      const existing = await getRule(db, userId, param(req, 'ruleId'), await todayForUser(db, userId));
      await assertCategory(input.type ?? existing.type, input.category ?? existing.category);
    }
    const today = await todayForUser(db, userId);
    res.json({ rule: await updateRule(db, userId, param(req, 'ruleId'), input, today) });
  });

  router.delete('/:ruleId', async (req, res) => {
    const userId = currentUserId(res);
    await deleteRule(db, userId, param(req, 'ruleId'));
    res.json({ ok: true });
  });

  return router;
}
