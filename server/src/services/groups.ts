import { randomBytes } from 'node:crypto';
import type { Db } from '../db.js';
import { audit, immediate } from '../db.js';
import { conflict, forbidden, notFound, badRequest } from '../lib/errors.js';
import { sha256, uuid } from '../lib/ids.js';
import { nowIso, nowMs } from '../lib/time.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1

export interface GroupRow {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

function randomCode(): string {
  const bytes = randomBytes(12);
  let raw = '';
  for (let i = 0; i < 12; i += 1) raw += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

export function normalizeInvitationCode(raw: string): string {
  return raw.replace(/[\s-]/g, '').toUpperCase();
}

export function formatInvitationCode(raw: string): string {
  const normalized = normalizeInvitationCode(raw);
  return `${normalized.slice(0, 4)}-${normalized.slice(4, 8)}-${normalized.slice(8, 12)}`;
}

export function getGroup(db: Db, groupId: string): GroupRow {
  const row = db.prepare('SELECT * FROM private_groups WHERE id = ?').get(groupId) as GroupRow | undefined;
  if (!row) throw notFound('Gruppen hittades inte.');
  return row;
}

export function requireMembership(db: Db, groupId: string, userId: string): GroupRow {
  const group = getGroup(db, groupId);
  const member = db
    .prepare('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?')
    .get(groupId, userId) as { role: 'owner' | 'member' } | undefined;
  if (!member) throw forbidden('Du är inte medlem i den här gruppen.');
  return group;
}

export function requireOwner(db: Db, groupId: string, userId: string): GroupRow {
  const group = requireMembership(db, groupId, userId);
  if (group.owner_id !== userId) throw forbidden('Bara gruppens ägare kan göra detta.');
  return group;
}

export function createGroup(db: Db, userId: string, name: string): GroupRow {
  return immediate(db, () => {
    const id = uuid();
    const now = nowIso();
    db.prepare('INSERT INTO private_groups (id, name, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(
      id,
      name,
      userId,
      now,
      now,
    );
    db.prepare('INSERT INTO group_members (group_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)').run(
      id,
      userId,
      'owner',
      now,
    );
    audit(db, 'group.created', userId, id);
    return getGroup(db, id);
  });
}

export interface GroupSummary {
  id: string;
  name: string;
  role: 'owner' | 'member';
  memberCount: number;
  createdAt: string;
  competitionCount: number;
}

export function listGroups(db: Db, userId: string): GroupSummary[] {
  const rows = db
    .prepare(
      `SELECT g.id, g.name, g.created_at AS createdAt, m.role,
              (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS memberCount,
              (SELECT COUNT(*) FROM competitions c WHERE c.group_id = g.id) AS competitionCount
       FROM private_groups g JOIN group_members m ON m.group_id = g.id AND m.user_id = ?
       ORDER BY g.created_at ASC`,
    )
    .all(userId) as Array<{
    id: string;
    name: string;
    createdAt: string;
    role: 'owner' | 'member';
    memberCount: number;
    competitionCount: number;
  }>;
  return rows;
}

export interface InvitationMetadata {
  id: string;
  label: string | null;
  maxUses: number;
  usesCount: number;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  createdBy: string;
  status: 'active' | 'expired' | 'revoked' | 'used';
}

function invitationStatus(row: {
  revoked_at: string | null;
  expires_at: string | null;
  uses_count: number;
  max_uses: number;
}): InvitationMetadata['status'] {
  if (row.revoked_at) return 'revoked';
  if (row.expires_at && Date.parse(row.expires_at) <= nowMs()) return 'expired';
  if (row.uses_count >= row.max_uses) return 'used';
  return 'active';
}

export function listInvitations(db: Db, groupId: string): InvitationMetadata[] {
  const rows = db
    .prepare(
      `SELECT id, label, max_uses, uses_count, expires_at, revoked_at, created_at, created_by
       FROM invitation_codes WHERE group_id = ? ORDER BY created_at DESC`,
    )
    .all(groupId) as Array<{
    id: string;
    label: string | null;
    max_uses: number;
    uses_count: number;
    expires_at: string | null;
    revoked_at: string | null;
    created_at: string;
    created_by: string;
  }>;
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    maxUses: row.max_uses,
    usesCount: row.uses_count,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
    createdBy: row.created_by,
    status: invitationStatus(row),
  }));
}

export interface CreatedInvitation {
  id: string;
  code: string; // returned exactly once, never stored in plaintext
  expiresAt: string | null;
  maxUses: number;
  label: string | null;
}

export function createInvitation(
  db: Db,
  userId: string,
  groupId: string,
  input: { label?: string | null; maxUses: number; expiresInHours: number | null },
): CreatedInvitation {
  requireOwner(db, groupId, userId);
  const code = randomCode();
  const id = uuid();
  const expiresAt = input.expiresInHours === null ? null : new Date(nowMs() + input.expiresInHours * 3600_000).toISOString();
  db.prepare(
    `INSERT INTO invitation_codes (id, group_id, code_hash, label, created_by, created_at, expires_at, max_uses, uses_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
  ).run(id, groupId, sha256(normalizeInvitationCode(code)), input.label ?? null, userId, nowIso(), expiresAt, input.maxUses);
  audit(db, 'group.invitation.created', userId, groupId, { invitationId: id, maxUses: input.maxUses });
  return { id, code, expiresAt, maxUses: input.maxUses, label: input.label ?? null };
}

export function revokeInvitation(db: Db, userId: string, invitationId: string): void {
  const row = db
    .prepare('SELECT id, group_id, created_by, revoked_at FROM invitation_codes WHERE id = ?')
    .get(invitationId) as
    | { id: string; group_id: string; created_by: string; revoked_at: string | null }
    | undefined;
  if (!row) throw notFound('Inbjudan hittades inte.');
  const group = requireMembership(db, row.group_id, userId);
  if (group.owner_id !== userId && row.created_by !== userId) {
    throw forbidden('Du kan bara återkalla inbjudningar du själv skapat.');
  }
  if (row.revoked_at) throw conflict('Inbjudan är redan återkallad.');
  db.prepare('UPDATE invitation_codes SET revoked_at = ? WHERE id = ?').run(nowIso(), row.id);
  audit(db, 'group.invitation.revoked', userId, row.group_id, { invitationId: row.id });
}

export interface JoinResult {
  groupId: string;
  groupName: string;
  alreadyMember: boolean;
}

/**
 * Redeems an invitation code. Runs in an IMMEDIATE transaction so that the usage counter can never
 * be exceeded, even with concurrent requests from different connections.
 */
export function joinGroupByCode(db: Db, userId: string, rawCode: string): JoinResult {
  const normalized = normalizeInvitationCode(rawCode);
  if (normalized.length !== 12) throw badRequest('Inbjudningskoden ska ha 12 tecken.');
  return immediate(db, () => {
    const invitation = db
      .prepare(
        `SELECT id, group_id, max_uses, uses_count, expires_at, revoked_at
         FROM invitation_codes WHERE code_hash = ?`,
      )
      .get(sha256(normalized)) as
      | {
          id: string;
          group_id: string;
          max_uses: number;
          uses_count: number;
          expires_at: string | null;
          revoked_at: string | null;
        }
      | undefined;
    if (!invitation) throw notFound('Inbjudningskoden är ogiltig.');
    if (invitation.revoked_at) throw conflict('Inbjudningskoden är återkallad.');
    if (invitation.expires_at && Date.parse(invitation.expires_at) <= nowMs()) {
      throw conflict('Inbjudningskoden har gått ut.');
    }
    if (invitation.uses_count >= invitation.max_uses) throw conflict('Inbjudningskoden har redan använts maximalt antal gånger.');

    const group = getGroup(db, invitation.group_id);
    const existing = db
      .prepare('SELECT 1 AS ok FROM group_members WHERE group_id = ? AND user_id = ?')
      .get(invitation.group_id, userId) as { ok: number } | undefined;
    if (existing) {
      return { groupId: group.id, groupName: group.name, alreadyMember: true };
    }

    db.prepare('INSERT INTO group_members (group_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)').run(
      invitation.group_id,
      userId,
      'member',
      nowIso(),
    );
    const consumed = db
      .prepare('UPDATE invitation_codes SET uses_count = uses_count + 1 WHERE id = ? AND uses_count < max_uses')
      .run(invitation.id);
    if (consumed.changes !== 1) {
      throw conflict('Inbjudningskoden har redan använts maximalt antal gånger.');
    }
    audit(db, 'group.joined', userId, invitation.group_id, { invitationId: invitation.id });
    return { groupId: group.id, groupName: group.name, alreadyMember: false };
  });
}

export interface GroupMemberView {
  alias: string;
  role: 'owner' | 'member';
  joinedAt: string;
  isYou: boolean;
}

export interface GroupDetail {
  group: GroupRow;
  role: 'owner' | 'member';
  members: GroupMemberView[];
  invitations: InvitationMetadata[];
  competitions: Array<{
    id: string;
    name: string;
    status: string;
    durationDays: number;
    startsAt: string;
    endsAt: string;
    participantCount: number;
  }>;
}

/**
 * Group detail deliberately exposes only aliases and membership roles. No balances, goals,
 * transactions or scores of other members are reachable from this projection.
 */
export function groupDetail(db: Db, userId: string, groupId: string): GroupDetail {
  const group = requireMembership(db, groupId, userId);
  const roleRow = db
    .prepare('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?')
    .get(groupId, userId) as { role: 'owner' | 'member' };
  const members = db
    .prepare(
      `SELECT p.alias, m.role, m.joined_at AS joinedAt, m.user_id AS userId
       FROM group_members m JOIN profiles p ON p.user_id = m.user_id
       WHERE m.group_id = ?
       ORDER BY CASE m.role WHEN 'owner' THEN 0 ELSE 1 END, m.joined_at ASC`,
    )
    .all(groupId) as Array<{ alias: string; role: 'owner' | 'member'; joinedAt: string; userId: string }>;
  const competitions = db
    .prepare(
      `SELECT c.id, c.name, c.status, c.duration_days AS durationDays, c.starts_at AS startsAt,
              c.ends_at AS endsAt,
              (SELECT COUNT(*) FROM competition_participants p
               WHERE p.competition_id = c.id AND p.withdrawn_at IS NULL) AS participantCount
       FROM competitions c WHERE c.group_id = ?
       ORDER BY c.starts_at DESC`,
    )
    .all(groupId) as GroupDetail['competitions'];
  return {
    group,
    role: roleRow.role,
    members: members.map((member) => ({
      alias: member.alias,
      role: member.role,
      joinedAt: member.joinedAt,
      isYou: member.userId === userId,
    })),
    invitations: group.owner_id === userId ? listInvitations(db, groupId) : [],
    competitions,
  };
}

export function leaveGroup(db: Db, userId: string, groupId: string): { groupDeleted: boolean; newOwnerId: string | null } {
  return immediate(db, () => {
    const group = requireMembership(db, groupId, userId);
    const others = db
      .prepare(
        `SELECT user_id FROM group_members WHERE group_id = ? AND user_id <> ?
         ORDER BY joined_at ASC, user_id ASC LIMIT 1`,
      )
      .get(groupId, userId) as { user_id: string } | undefined;
    db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(groupId, userId);
    if (!others) {
      // Last member: the group (and its private competitions, by cascade) is removed.
      db.prepare('DELETE FROM private_groups WHERE id = ?').run(groupId);
      audit(db, 'group.deleted', userId, groupId);
      return { groupDeleted: true, newOwnerId: null };
    }
    if (group.owner_id === userId) {
      db.prepare('UPDATE private_groups SET owner_id = ?, updated_at = ? WHERE id = ?').run(
        others.user_id,
        nowIso(),
        groupId,
      );
      db.prepare('UPDATE group_members SET role = ? WHERE group_id = ? AND user_id = ?').run(
        'owner',
        groupId,
        others.user_id,
      );
    }
    audit(db, 'group.left', userId, groupId);
    return { groupDeleted: false, newOwnerId: group.owner_id === userId ? others.user_id : null };
  });
}
