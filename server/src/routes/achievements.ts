import { Router } from 'express';
import type { Db } from '../db.js';
import { currentUserId, requireAuth } from '../lib/http.js';
import { achievementCatalog, levelFor } from '../services/achievements.js';
import { dashboard } from '../services/dashboard.js';
import { runDueRules, todayForUser } from '../services/recurring.js';

export function dashboardRoutes(db: Db): Router {
  const router = Router();
  router.use(requireAuth);
  router.get('/', async (req, res) => {
    const userId = currentUserId(res);
    // The overview opens the app for most people, so this is where recurring entries come due.
    // Booking first keeps the tiles and the "per month" card telling the same story.
    await runDueRules(db, userId, await todayForUser(db, userId));
    res.json(await dashboard(db, userId));
  });
  return router;
}

export function achievementRoutes(db: Db): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/', async (req, res) => {
    const userId = currentUserId(res);
    const data = await achievementCatalog(db, userId);
    res.json({
      ...data,
      levels: [0, 2, 3, 4, 5].map((min, index) => ({
        level: index + 1,
        required: min,
        current: data.totalEarned >= min,
      })),
      levelInfo: await levelFor(data.totalEarned),
    });
  });

  return router;
}
