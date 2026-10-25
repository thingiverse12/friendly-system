import { Router } from 'express';
import { z } from 'zod';
import type { Db } from '../db.js';
import { currentUserId, requireAuth, param } from '../lib/http.js';
import { amountOreSchema, goalNameSchema, isoDateSchema, parseBody, parseQuery } from '../lib/validation.js';
import {
  createGoal,
  deleteGoal,
  getOwnedGoal,
  listGoals,
  listMovements,
  recordMovement,
  setArchived,
  toGoalView,
  updateGoal,
  type GoalView,
} from '../services/goals.js';
import { achievementCatalog } from '../services/achievements.js';

const createGoalSchema = z.object({
  name: goalNameSchema,
  targetAmountOre: amountOreSchema,
  privacy: z.enum(['private', 'alias_visible']).default('private'),
});

const updateGoalSchema = z
  .object({
    name: goalNameSchema.optional(),
    targetAmountOre: amountOreSchema.optional(),
    privacy: z.enum(['private', 'alias_visible']).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Inget att uppdatera.');

const movementSchema = z.object({
  type: z.enum(['deposit', 'withdrawal']),
  amountOre: amountOreSchema,
  note: z.string().trim().max(280, 'Anteckningen får vara högst 280 tecken.').optional(),
  occurredAt: isoDateSchema.optional(),
});

const listQuerySchema = z.object({
  includeArchived: z.enum(['0', '1']).optional().default('0'),
});

export function goalRoutes(db: Db): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/', (req, res) => {
    const userId = currentUserId(res);
    const query = parseQuery(listQuerySchema, req.query);
    const goals = listGoals(db, userId, query.includeArchived === '1');
    res.json({
      goals,
      totals: {
        savedOre: goals.filter((goal) => !goal.archived).reduce((sum, goal) => sum + goal.balanceOre, 0),
        targetOre: goals.filter((goal) => !goal.archived).reduce((sum, goal) => sum + goal.targetAmountOre, 0),
      },
    });
  });

  router.post('/', (req, res) => {
    const userId = currentUserId(res);
    const input = parseBody(createGoalSchema, req.body);
    const goal = createGoal(db, userId, {
      name: input.name,
      targetAmountOre: input.targetAmountOre,
      privacy: input.privacy,
    });
    res.status(201).json({ goal });
  });

  router.get('/:goalId', (req, res) => {
    const userId = currentUserId(res);
    const goal = getOwnedGoal(db, userId, param(req, 'goalId'));
    const view: GoalView = toGoalView(db, goal);
    res.json({
      goal: view,
      movements: listMovements(db, userId, goal.id),
      achievements: achievementCatalog(db, userId).catalog.filter((item) =>
        item.goals.some((award) => award.goalId === goal.id),
      ),
    });
  });

  router.patch('/:goalId', (req, res) => {
    const userId = currentUserId(res);
    const input = parseBody(updateGoalSchema, req.body);
    const goal = updateGoal(db, userId, param(req, 'goalId'), input);
    res.json({ goal });
  });

  router.post('/:goalId/archive', (req, res) => {
    const userId = currentUserId(res);
    const goal = setArchived(db, userId, param(req, 'goalId'), true);
    res.json({ goal });
  });

  router.post('/:goalId/unarchive', (req, res) => {
    const userId = currentUserId(res);
    const goal = setArchived(db, userId, param(req, 'goalId'), false);
    res.json({ goal });
  });

  router.delete('/:goalId', (req, res) => {
    const userId = currentUserId(res);
    deleteGoal(db, userId, param(req, 'goalId'));
    res.json({ ok: true });
  });

  router.get('/:goalId/movements', (req, res) => {
    const userId = currentUserId(res);
    res.json({ movements: listMovements(db, userId, param(req, 'goalId')) });
  });

  router.post('/:goalId/movements', (req, res) => {
    const userId = currentUserId(res);
    const input = parseBody(movementSchema, req.body);
    const result = recordMovement(db, userId, param(req, 'goalId'), {
      type: input.type,
      amountOre: input.amountOre,
      note: input.note ?? null,
      occurredAt: input.occurredAt,
    });
    res.status(201).json(result);
  });

  return router;
}
