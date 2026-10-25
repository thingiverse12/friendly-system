import type { Db } from '../db.js';
import { audit, immediate } from '../db.js';
import { conflict, forbidden, notFound, unauthorized } from '../lib/errors.js';
import { hashPassword, verifyDummy, verifyPassword } from '../lib/password.js';
import { normalizeAlias, randomAlias, uuid } from '../lib/ids.js';
import { nowIso } from '../lib/time.js';
import { levelFor } from './achievements.js';
import { revokeAllSessions } from './sessions.js';

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
  deleted_at: string | null;
}

export interface ProfileRow {
  user_id: string;
  alias: string;
  alias_normalized: string;
  timezone: string;
  public_competition_consent: number;
  share_badges: number;
  created_at: string;
  updated_at: string;
}

export interface PublicUser {
  id: string;
  email: string;
  createdAt: string;
  profile: {
    alias: string;
    timezone: string;
    publicCompetitionConsent: boolean;
    shareBadges: boolean;
    createdAt: string;
  };
}

export function getUserById(db: Db, userId: string): UserRow {
  const user = db.prepare('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL').get(userId) as
    | UserRow
    | undefined;
  if (!user) throw unauthorized();
  return user;
}

export function getProfile(db: Db, userId: string): ProfileRow {
  const profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId) as ProfileRow | undefined;
  if (!profile) throw notFound('Profilen hittades inte.');
  return profile;
}

export function toPublicUser(user: UserRow, profile: ProfileRow): PublicUser {
  return {
    id: user.id,
    email: user.email,
    createdAt: user.created_at,
    profile: {
      alias: profile.alias,
      timezone: profile.timezone,
      publicCompetitionConsent: profile.public_competition_consent === 1,
      shareBadges: profile.share_badges === 1,
      createdAt: profile.created_at,
    },
  };
}

export function aliasTaken(db: Db, alias: string, exceptUserId?: string): boolean {
  const normalized = normalizeAlias(alias);
  const row = db
    .prepare('SELECT user_id FROM profiles WHERE alias_normalized = ? AND (? IS NULL OR user_id <> ?)')
    .get(normalized, exceptUserId ?? null, exceptUserId ?? null) as { user_id: string } | undefined;
  return Boolean(row);
}

export function uniqueSuggestion(db: Db): string {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = randomAlias();
    if (!aliasTaken(db, candidate)) return candidate;
  }
  return `sparlygd_${uuid().slice(0, 8)}`;
}

export interface RegisterInput {
  email: string;
  password: string;
  alias?: string | undefined;
  timezone?: string | undefined;
  publicCompetitionConsent?: boolean | undefined;
  shareBadges?: boolean | undefined;
}

export async function registerUser(
  db: Db,
  input: RegisterInput,
): Promise<{ user: PublicUser; userId: string }> {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(input.email) as { id: string } | undefined;
  if (existing) throw conflict('Det finns redan ett konto med den e-postadressen.');
  const alias = input.alias ?? uniqueSuggestion(db);
  if (aliasTaken(db, alias)) throw conflict('Aliaset är upptaget. Välj ett annat.');

  const passwordHash = await hashPassword(input.password);
  const userId = uuid();
  const now = nowIso();
  immediate(db, () => {
    db.prepare(
      `INSERT INTO users (id, email, password_hash, password_algo, created_at, updated_at)
       VALUES (?, ?, ?, 'argon2id', ?, ?)`,
    ).run(userId, input.email, passwordHash, now, now);
    db.prepare(
      `INSERT INTO profiles (user_id, alias, alias_normalized, timezone, public_competition_consent, share_badges, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      userId,
      alias,
      normalizeAlias(alias),
      input.timezone ?? 'Europe/Stockholm',
      input.publicCompetitionConsent ? 1 : 0,
      input.shareBadges ? 1 : 0,
      now,
      now,
    );
    audit(db, 'account.registered', userId, null, { consent: Boolean(input.publicCompetitionConsent) });
  });
  return {
    user: toPublicUser(getUserById(db, userId), getProfile(db, userId)),
    userId,
  };
}

export async function authenticate(db: Db, email: string, password: string): Promise<UserRow> {
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND deleted_at IS NULL').get(email) as
    | UserRow
    | undefined;
  if (!user) {
    await verifyDummy(password);
    throw unauthorized('E-post eller lösenord stämmer inte.');
  }
  const ok = await verifyPassword(user.password_hash, password);
  if (!ok) throw unauthorized('E-post eller lösenord stämmer inte.');
  return user;
}

export interface UpdateProfileInput {
  alias?: string | undefined;
  timezone?: string | undefined;
  publicCompetitionConsent?: boolean | undefined;
  shareBadges?: boolean | undefined;
}

export function updateProfile(db: Db, userId: string, input: UpdateProfileInput): PublicUser {
  return immediate(db, () => {
    const user = getUserById(db, userId);
    const profile = getProfile(db, userId);
    if (input.alias !== undefined && normalizeAlias(input.alias) !== profile.alias_normalized) {
      if (aliasTaken(db, input.alias, userId)) throw conflict('Aliaset är upptaget. Välj ett annat.');
    }
    db.prepare(
      `UPDATE profiles SET alias = ?, alias_normalized = ?, timezone = ?, public_competition_consent = ?,
        share_badges = ?, updated_at = ? WHERE user_id = ?`,
    ).run(
      input.alias ?? profile.alias,
      input.alias !== undefined ? normalizeAlias(input.alias) : profile.alias_normalized,
      input.timezone ?? profile.timezone,
      input.publicCompetitionConsent === undefined
        ? profile.public_competition_consent
        : input.publicCompetitionConsent
          ? 1
          : 0,
      input.shareBadges === undefined ? profile.share_badges : input.shareBadges ? 1 : 0,
      nowIso(),
      userId,
    );
    audit(db, 'profile.updated', userId, null, {
      consentChanged:
        input.publicCompetitionConsent !== undefined &&
        input.publicCompetitionConsent !== (profile.public_competition_consent === 1),
    });
    return toPublicUser(user, getProfile(db, userId));
  });
}

export interface ProfileStats {
  goalCount: number;
  activeGoalCount: number;
  totalSavedOre: number;
  totalTargetOre: number;
  achievementCount: number;
  level: { level: number; name: string; earnedCount: number; nextLevelAt: number | null; progressToNextBps: number };
  competitionCount: number;
  memberSince: string;
}

export function profileStats(db: Db, userId: string): ProfileStats {
  const goals = db
    .prepare(
      `SELECT COUNT(*) AS goalCount,
              COALESCE(SUM(CASE WHEN archived_at IS NULL THEN 1 ELSE 0 END), 0) AS activeGoalCount,
              COALESCE(SUM(balance_ore), 0) AS totalSaved,
              COALESCE(SUM(target_amount_ore), 0) AS totalTarget
       FROM savings_goals WHERE owner_id = ?`,
    )
    .get(userId) as { goalCount: number; activeGoalCount: number; totalSaved: number; totalTarget: number };
  const achievements = db
    .prepare('SELECT COUNT(DISTINCT achievement_id) AS count FROM user_achievements WHERE user_id = ?')
    .get(userId) as { count: number };
  const competitions = db
    .prepare(
      `SELECT COUNT(*) AS count FROM competition_participants
       WHERE user_id = ? AND withdrawn_at IS NULL`,
    )
    .get(userId) as { count: number };
  const user = getUserById(db, userId);
  return {
    goalCount: goals.goalCount,
    activeGoalCount: goals.activeGoalCount,
    totalSavedOre: goals.totalSaved,
    totalTargetOre: goals.totalTarget,
    achievementCount: achievements.count,
    level: levelFor(achievements.count),
    competitionCount: competitions.count,
    memberSince: user.created_at,
  };
}

export interface DeletionSummary {
  deletedGoals: number;
  deletedTransactions: number;
  deletedMovements: number;
  deletedAchievements: number;
  groupsTransferred: number;
  groupsDeleted: number;
  competitionsLeft: number;
}

/**
 * Documented account-deletion policy (see README "Data deletion"):
 *  - the password must be confirmed first;
 *  - all personal and financial data is deleted immediately and irreversibly
 *    (profile, goals, movements, transactions, achievements, sessions, reset tokens);
 *  - group ownership is transferred to the earliest remaining member, otherwise the group is deleted;
 *  - competition participations are removed, so the user no longer appears in any leaderboard;
 *  - the audit log keeps a pseudonymous event referencing only the random user UUID (never e-mail or alias).
 */
export function deleteAccount(db: Db, userId: string, summary: DeletionSummary): void {
  immediate(db, () => {
    const ownedGroups = db
      .prepare('SELECT id FROM private_groups WHERE owner_id = ?')
      .all(userId) as Array<{ id: string }>;
    for (const group of ownedGroups) {
      const next = db
        .prepare(
          `SELECT user_id FROM group_members WHERE group_id = ? AND user_id <> ?
           ORDER BY joined_at ASC, user_id ASC LIMIT 1`,
        )
        .get(group.id, userId) as { user_id: string } | undefined;
      if (next) {
        db.prepare('UPDATE private_groups SET owner_id = ?, updated_at = ? WHERE id = ?').run(
          next.user_id,
          nowIso(),
          group.id,
        );
        db.prepare('UPDATE group_members SET role = ? WHERE group_id = ? AND user_id = ?').run(
          'owner',
          group.id,
          next.user_id,
        );
        summary.groupsTransferred += 1;
      }
    }
    revokeAllSessions(db, userId);
    // Everything else is removed through ON DELETE CASCADE from users.
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    summary.groupsDeleted = ownedGroups.length - summary.groupsTransferred;
    audit(db, 'account.deleted', userId, null, { ...summary });
    db.prepare(
      'INSERT INTO audit_events (id, actor_user_id, event, target, metadata, created_at) VALUES (?, NULL, ?, NULL, ?, ?)',
    ).run(uuid(), 'account.deletion_policy_applied', JSON.stringify({ deletedUserId: userId }), nowIso());
  });
}

export async function confirmPassword(db: Db, userId: string, password: string): Promise<void> {
  const user = getUserById(db, userId);
  const ok = await verifyPassword(user.password_hash, password);
  if (!ok) throw forbidden('Lösenordet stämmer inte.');
}
