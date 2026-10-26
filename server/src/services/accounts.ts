import type { Db } from '../db.js';
import { audit } from '../db.js';
import { conflict, notFound, unauthorized } from '../lib/errors.js';
import { normalizeAlias, randomAlias, uuid } from '../lib/ids.js';
import { nowIso } from '../lib/time.js';
import { levelFor } from './achievements.js';
import { revokeAllSessions } from './sessions.js';
import type { SupabaseIdentity } from './supabase.js';

export interface UserRow {
  id: string;
  email: string;
  email_verified: number;
  created_at: string;
  updated_at: string;
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

export async function getUserById(db: Db, userId: string): Promise<UserRow> {
  const user = await db.one<UserRow>('SELECT * FROM users WHERE id = $1', [userId]);
  if (!user) throw unauthorized();
  return user;
}

export async function getProfile(db: Db, userId: string): Promise<ProfileRow> {
  const profile = await db.one<ProfileRow>('SELECT * FROM profiles WHERE user_id = $1', [userId]);
  if (!profile) throw notFound('Profilen hittades inte.');
  return profile;
}

export async function toPublicUser(user: UserRow, profile: ProfileRow): Promise<PublicUser> {
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

export async function aliasTaken(db: Db, alias: string, exceptUserId?: string): Promise<boolean> {
  const normalized = normalizeAlias(alias);
  const row = await db.one(
    'SELECT user_id FROM profiles WHERE alias_normalized = $1 AND ($2::uuid IS NULL OR user_id <> $2::uuid)',
    [normalized, exceptUserId ?? null],
  );
  return Boolean(row);
}

export async function uniqueSuggestion(db: Db): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = randomAlias();
    if (!(await aliasTaken(db, candidate))) return candidate;
  }
  return `sparlygd_${uuid().slice(0, 8)}`;
}

export interface ProvisionInput {
  alias?: string | undefined;
  timezone?: string | undefined;
  publicCompetitionConsent?: boolean | undefined;
  shareBadges?: boolean | undefined;
}

/**
 * Maps a verified Supabase identity onto the app's own user row. Credentials live in Supabase Auth;
 * this record only carries the data Sparly needs (e-mail for contact, profile, finance).
 */
export async function provisionUserFromSupabase(
  db: Db,
  identity: SupabaseIdentity,
  input: ProvisionInput = {},
): Promise<{ user: PublicUser; created: boolean }> {
  const existing = await db.one<UserRow>('SELECT * FROM users WHERE id = $1', [identity.id]);
  if (existing) {
    if (existing.email !== identity.email || existing.email_verified !== (identity.emailVerified ? 1 : 0)) {
      await db.run('UPDATE users SET email = $1, email_verified = $2, updated_at = $3 WHERE id = $4', [
        identity.email,
        identity.emailVerified ? 1 : 0,
        nowIso(),
        identity.id,
      ]);
    }
    const profile = await getProfile(db, identity.id);
    return { user: await toPublicUser(await getUserById(db, identity.id), profile), created: false };
  }

  // A deleted account may leave the e-mail behind in an audit row; free the unique constraint first.
  const emailClash = await db.one<{ id: string }>('SELECT id FROM users WHERE email = $1', [identity.email]);
  if (emailClash) throw conflict('Det finns redan ett konto med den e-postadressen.');

  const alias = input.alias ?? (await uniqueSuggestion(db));
  if (await aliasTaken(db, alias)) throw conflict('Aliaset är upptaget. Välj ett annat.');
  const now = nowIso();

  await db.tx(async (tx) => {
    await tx.run(
      `INSERT INTO users (id, email, email_verified, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $4)`,
      [identity.id, identity.email, identity.emailVerified ? 1 : 0, now],
    );
    await tx.run(
      `INSERT INTO profiles (user_id, alias, alias_normalized, timezone, public_competition_consent, share_badges, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
      [
        identity.id,
        alias,
        normalizeAlias(alias),
        input.timezone ?? 'Europe/Stockholm',
        input.publicCompetitionConsent ? 1 : 0,
        input.shareBadges ? 1 : 0,
        now,
      ],
    );
    await audit(tx, 'account.created', identity.id, null, {
      consent: Boolean(input.publicCompetitionConsent),
      provider: 'supabase',
    });
  });

  return {
    user: await toPublicUser(await getUserById(db, identity.id), await getProfile(db, identity.id)),
    created: true,
  };
}

export interface UpdateProfileInput {
  alias?: string | undefined;
  timezone?: string | undefined;
  publicCompetitionConsent?: boolean | undefined;
  shareBadges?: boolean | undefined;
}

export async function updateProfile(db: Db, userId: string, input: UpdateProfileInput): Promise<PublicUser> {
  return db.tx(async (tx) => {
    const user = await getUserById(tx, userId);
    const profile = await getProfile(tx, userId);
    if (input.alias !== undefined && normalizeAlias(input.alias) !== profile.alias_normalized) {
      if (await aliasTaken(tx, input.alias, userId)) throw conflict('Aliaset är upptaget. Välj ett annat.');
    }
    await tx.run(
      `UPDATE profiles SET alias = $1, alias_normalized = $2, timezone = $3,
        public_competition_consent = $4, share_badges = $5, updated_at = $6 WHERE user_id = $7`,
      [
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
      ],
    );
    await audit(tx, 'profile.updated', userId, null, {
      consentChanged:
        input.publicCompetitionConsent !== undefined &&
        input.publicCompetitionConsent !== (profile.public_competition_consent === 1),
      badgesChanged:
        input.shareBadges !== undefined && input.shareBadges !== (profile.share_badges === 1),
    });
    return toPublicUser(user, await getProfile(tx, userId));
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

export async function profileStats(db: Db, userId: string): Promise<ProfileStats> {
  const goals = await db.one<{
    goalcount: number;
    activegoalcount: number;
    totalsaved: number;
    totaltarget: number;
  }>(
    `SELECT COUNT(*)::int AS "goalCount",
            COALESCE(SUM(CASE WHEN archived_at IS NULL THEN 1 ELSE 0 END), 0)::int AS "activeGoalCount",
            COALESCE(SUM(balance_ore), 0)::bigint AS "totalSaved",
            COALESCE(SUM(target_amount_ore), 0)::bigint AS "totalTarget"
     FROM savings_goals WHERE owner_id = $1`,
    [userId],
  );
  const achievements = await db.one<{ count: number }>(
    'SELECT COUNT(DISTINCT achievement_id)::int AS count FROM user_achievements WHERE user_id = $1',
    [userId],
  );
  const competitions = await db.one<{ count: number }>(
    'SELECT COUNT(*)::int AS count FROM competition_participants WHERE user_id = $1 AND withdrawn_at IS NULL',
    [userId],
  );
  const user = await getUserById(db, userId);
  const earnedCount = achievements?.count ?? 0;
  return {
    goalCount: goals?.goalcount ?? 0,
    activeGoalCount: goals?.activegoalcount ?? 0,
    totalSavedOre: goals?.totalsaved ?? 0,
    totalTargetOre: goals?.totaltarget ?? 0,
    achievementCount: earnedCount,
    level: await levelFor(earnedCount),
    competitionCount: competitions?.count ?? 0,
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
}

export async function deletionSummaryFor(db: Db, userId: string): Promise<DeletionSummary> {
  const row = await db.one<{
    goals: number;
    transactions: number;
    movements: number;
    achievements: number;
    groups: number;
  }>(
    `SELECT
       (SELECT COUNT(*)::int FROM savings_goals WHERE owner_id = $1) AS goals,
       (SELECT COUNT(*)::int FROM transactions WHERE owner_id = $1) AS transactions,
       (SELECT COUNT(*)::int FROM savings_movements WHERE owner_id = $1) AS movements,
       (SELECT COUNT(*)::int FROM user_achievements WHERE user_id = $1) AS achievements,
       (SELECT COUNT(*)::int FROM private_groups WHERE owner_id = $1) AS groups`,
    [userId],
  );
  return {
    deletedGoals: row?.goals ?? 0,
    deletedTransactions: row?.transactions ?? 0,
    deletedMovements: row?.movements ?? 0,
    deletedAchievements: row?.achievements ?? 0,
    groupsTransferred: 0,
    groupsDeleted: row?.groups ?? 0,
  };
}

/**
 * Account deletion policy:
 *  - all personal and financial data is deleted immediately (profile, goals, movements,
 *    transactions, achievements, sessions, memberships, participations);
 *  - group ownership is transferred to the earliest remaining member, groups without members go;
 *  - the audit trail keeps a pseudonymous event referencing only the random user UUID.
 * The Supabase Auth user is removed by the route after this transaction succeeds.
 */
export async function deleteAccount(db: Db, userId: string, summary: DeletionSummary): Promise<DeletionSummary> {
  return db.tx(async (tx) => {
    const ownedGroups = await tx.query<{ id: string }>('SELECT id FROM private_groups WHERE owner_id = $1', [userId]);
    for (const group of ownedGroups) {
      const next = await tx.one<{ user_id: string }>(
        `SELECT user_id FROM group_members WHERE group_id = $1 AND user_id <> $2
         ORDER BY joined_at ASC, user_id ASC LIMIT 1`,
        [group.id, userId],
      );
      if (next) {
        await tx.run('UPDATE private_groups SET owner_id = $1, updated_at = $2 WHERE id = $3', [
          next.user_id,
          nowIso(),
          group.id,
        ]);
        await tx.run('UPDATE group_members SET role = $1 WHERE group_id = $2 AND user_id = $3', [
          'owner',
          group.id,
          next.user_id,
        ]);
        summary.groupsTransferred += 1;
      }
    }
    await tx.run('UPDATE sessions SET revoked_at = $1 WHERE user_id = $2 AND revoked_at IS NULL', [nowIso(), userId]);
    await audit(tx, 'account.deleted', userId, null, { ...summary });
    // Cascades remove profile, goals, ledger, transactions, achievements, memberships, participations.
    await tx.run('DELETE FROM users WHERE id = $1', [userId]);
    summary.groupsDeleted = ownedGroups.length - summary.groupsTransferred;
    await tx.run(
      `INSERT INTO audit_events (id, actor_user_id, event, target, metadata, created_at)
       VALUES ($1, NULL, $2, NULL, $3, $4)`,
      [uuid(), 'account.deletion_policy_applied', JSON.stringify({ deletedUserId: userId }), nowIso()],
    );
    return summary;
  });
}

export async function revokeEverything(db: Db, userId: string): Promise<void> {
  await revokeAllSessions(db, userId);
}
