import { Router } from 'express';
import { z } from 'zod';
import type { Db } from '../db.js';
import { currentUserId, rateLimit, requireAuth, param } from '../lib/http.js';
import { badRequest } from '../lib/errors.js';
import { parseBody, RATE_LIMITS } from '../lib/validation.js';
import {
  createGroup,
  createInvitation,
  groupDetail,
  joinGroupByCode,
  leaveGroup,
  listGroups,
  requireMembership,
  requireOwner,
  revokeInvitation,
} from '../services/groups.js';
import { createCompetition, ensurePublicCompetitions, syncCompetitionLifecycle } from '../services/competitions.js';
import { nowIso, nowMs, toIso } from '../lib/time.js';

const groupNameSchema = z.string().trim().min(2, 'Gruppnamnet måste vara minst 2 tecken.').max(60);

const createGroupSchema = z.object({ name: groupNameSchema });

const createInvitationSchema = z.object({
  label: z.string().trim().max(40).optional(),
  maxUses: z.number().int().min(1).max(100).default(1),
  expiresInHours: z.number().int().min(1).max(24 * 90).nullable().default(168),
});

const joinSchema = z.object({
  code: z.string().trim().min(12, 'Ange en inbjudningskod.').max(32),
});

const createGroupCompetitionSchema = z.object({
  name: z.string().trim().min(3, 'Namn måste vara minst 3 tecken.').max(80),
  description: z.string().trim().max(280).optional(),
  durationDays: z.union([z.literal(7), z.literal(30)]),
  startsInHours: z.number().int().min(0).max(24 * 30).default(0),
});

export function groupRoutes(db: Db): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/', (req, res) => {
    res.json({ groups: listGroups(db, currentUserId(res)) });
  });

  router.post(
    '/',
    rateLimit(db, 'group-create', RATE_LIMITS.groupCreate, (req, res) => res.locals.userId ?? ''),
    (req, res) => {
      const userId = currentUserId(res);
      const input = parseBody(createGroupSchema, req.body);
      const group = createGroup(db, userId, input.name);
      res.status(201).json({ group, role: 'owner' });
    },
  );

  router.post(
    '/join',
    rateLimit(db, 'group-join', RATE_LIMITS.invitationJoin, (req, res) => res.locals.userId ?? ''),
    (req, res) => {
      const userId = currentUserId(res);
      const input = parseBody(joinSchema, req.body);
      const result = joinGroupByCode(db, userId, input.code);
      res.status(result.alreadyMember ? 200 : 201).json({
        ok: true,
        ...result,
        message: result.alreadyMember
          ? `Du är redan med i ${result.groupName}.`
          : `Välkommen till ${result.groupName}!`,
      });
    },
  );

  router.get('/:groupId', (req, res) => {
    const userId = currentUserId(res);
    res.json(groupDetail(db, userId, param(req, 'groupId')));
  });

  router.post('/:groupId/invitations', rateLimit(db, 'invitation-create', RATE_LIMITS.invitationCreate), (req, res) => {
    const userId = currentUserId(res);
    const groupId = param(req, 'groupId');
    requireOwner(db, groupId, userId);
    const input = parseBody(createInvitationSchema, req.body);
    const invitation = createInvitation(db, userId, groupId, {
      label: input.label ?? null,
      maxUses: input.maxUses,
      expiresInHours: input.expiresInHours,
    });
    res.status(201).json({
      invitation,
      notice: 'Koden visas bara en gång. Vi sparar endast en hash av den.',
    });
  });

  router.delete('/:groupId/invitations/:invitationId', (req, res) => {
    const userId = currentUserId(res);
    revokeInvitation(db, userId, param(req, 'invitationId'));
    res.json({ ok: true });
  });

  router.post('/:groupId/leave', (req, res) => {
    const userId = currentUserId(res);
    const result = leaveGroup(db, userId, param(req, 'groupId'));
    res.json({ ok: true, ...result });
  });

  router.post('/:groupId/competitions', (req, res) => {
    syncCompetitionLifecycle(db);
    ensurePublicCompetitions(db);
    const userId = currentUserId(res);
    const groupId = param(req, 'groupId');
    requireMembership(db, groupId, userId);
    const input = parseBody(createGroupCompetitionSchema, req.body);
    const startsAt = toIso(nowMs() + input.startsInHours * 3600_000);
    if (Date.parse(startsAt) < Date.parse(nowIso()) - 60_000) throw badRequest('Ogiltig starttid.');
    const competition = createCompetition(db, {
      name: input.name,
      description: input.description ?? '',
      durationDays: input.durationDays,
      visibility: 'private',
      groupId,
      startsAt,
      createdBy: userId,
    });
    res.status(201).json({ competition });
  });

  return router;
}
