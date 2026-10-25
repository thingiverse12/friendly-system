import { Router } from 'express';
import type { Db } from '../db.js';
import { currentUserId, requireAuth } from '../lib/http.js';
import { achievementCatalog, levelFor } from '../services/achievements.js';
import { dashboard } from '../services/dashboard.js';

export function dashboardRoutes(db: Db): Router {
  const router = Router();
  router.use(requireAuth);
  router.get('/', (req, res) => {
    const userId = currentUserId(res);
    res.json(dashboard(db, userId));
  });
  return router;
}

export function achievementRoutes(db: Db): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/', (req, res) => {
    const userId = currentUserId(res);
    const data = achievementCatalog(db, userId);
    res.json({
      ...data,
      levels: [0, 2, 3, 4, 5].map((min, index) => ({
        level: index + 1,
        required: min,
        current: data.totalEarned >= min,
      })),
      levelInfo: levelFor(data.totalEarned),
    });
  });

  return router;
}
