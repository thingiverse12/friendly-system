/**
 * Postgres schema for Sparly (Supabase Postgres in production, PGlite in tests).
 *
 * Conventions kept deliberately from the SQLite edition so the domain rules stay identical:
 *  - money is BIGINT öre, scores are BIGINT centi-points: never floating point;
 *  - timestamps are ISO-8601 UTC text (`2026-10-25T20:57:10.000Z`), which sorts lexicographically
 *    and keeps the server clock as the single source of truth;
 *  - flags are SMALLINT 0/1 with CHECK constraints rather than booleans, so comparisons in the
 *    service layer cannot silently coerce.
 *
 * Every table is owned by the application; Supabase's `auth` schema owns credentials only.
 */

export interface Migration {
  id: string;
  name: string;
  sql: string;
}

export const migrations: Migration[] = [
  {
    id: '001',
    name: 'core_accounts_sessions_audit',
    sql: `
CREATE TABLE users (
  id             UUID PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE,
  email_verified SMALLINT NOT NULL DEFAULT 0 CHECK (email_verified IN (0, 1)),
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

CREATE TABLE profiles (
  user_id                    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  alias                      TEXT NOT NULL CHECK (length(alias) BETWEEN 3 AND 24),
  alias_normalized           TEXT NOT NULL UNIQUE,
  timezone                   TEXT NOT NULL DEFAULT 'Europe/Stockholm',
  public_competition_consent SMALLINT NOT NULL DEFAULT 0 CHECK (public_competition_consent IN (0, 1)),
  share_badges               SMALLINT NOT NULL DEFAULT 0 CHECK (share_badges IN (0, 1)),
  created_at                 TEXT NOT NULL,
  updated_at                 TEXT NOT NULL
);

CREATE TABLE sessions (
  id           TEXT PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token   TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  revoked_at   TEXT,
  user_agent   TEXT,
  ip_hash      TEXT
);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

CREATE TABLE audit_events (
  id            UUID PRIMARY KEY,
  actor_user_id UUID,
  event         TEXT NOT NULL,
  target        TEXT,
  metadata      JSONB,
  created_at    TEXT NOT NULL
);
CREATE INDEX idx_audit_actor ON audit_events(actor_user_id);

CREATE TABLE rate_limits (
  key          TEXT NOT NULL,
  window_start BIGINT NOT NULL,
  count        BIGINT NOT NULL CHECK (count >= 0),
  PRIMARY KEY (key, window_start)
);
`,
  },
  {
    id: '002',
    name: 'savings_goals_transactions_ledger',
    sql: `
CREATE TABLE savings_goals (
  id                UUID PRIMARY KEY,
  owner_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name              TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  target_amount_ore BIGINT NOT NULL CHECK (target_amount_ore > 0 AND target_amount_ore <= 100000000000),
  balance_ore       BIGINT NOT NULL DEFAULT 0 CHECK (balance_ore >= 0 AND balance_ore <= 100000000000),
  currency          TEXT NOT NULL DEFAULT 'SEK' CHECK (currency = 'SEK'),
  privacy           TEXT NOT NULL DEFAULT 'private' CHECK (privacy IN ('private', 'alias_visible')),
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  archived_at       TEXT
);
CREATE INDEX idx_goals_owner ON savings_goals(owner_id, archived_at);
CREATE INDEX idx_goals_owner_created ON savings_goals(owner_id, created_at DESC, id DESC);

CREATE TABLE transactions (
  id          UUID PRIMARY KEY,
  owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_id     UUID REFERENCES savings_goals(id) ON DELETE SET NULL,
  type        TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount_ore  BIGINT NOT NULL CHECK (amount_ore > 0 AND amount_ore <= 100000000000),
  category    TEXT NOT NULL CHECK (length(category) BETWEEN 1 AND 40),
  description TEXT CHECK (description IS NULL OR length(description) <= 280),
  occurred_at TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX idx_transactions_owner_occurred ON transactions(owner_id, occurred_at DESC);
CREATE INDEX idx_transactions_goal ON transactions(goal_id);

-- Append-only savings ledger: deposits and withdrawals only, never derived from income.
CREATE TABLE savings_movements (
  id                UUID PRIMARY KEY,
  owner_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_id           UUID NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
  type              TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal')),
  amount_ore        BIGINT NOT NULL CHECK (amount_ore > 0 AND amount_ore <= 100000000000),
  balance_after_ore BIGINT NOT NULL CHECK (balance_after_ore >= 0),
  note              TEXT CHECK (note IS NULL OR length(note) <= 280),
  occurred_at       TEXT NOT NULL,
  created_at        TEXT NOT NULL
);
CREATE INDEX idx_movements_owner ON savings_movements(owner_id, occurred_at);
CREATE INDEX idx_movements_goal ON savings_movements(goal_id, occurred_at);

-- A transaction may only point at a goal owned by the same user.
CREATE FUNCTION trg_goal_owner_check() RETURNS trigger AS $$
DECLARE
  goal_owner UUID;
BEGIN
  IF NEW.goal_id IS NOT NULL THEN
    SELECT owner_id INTO goal_owner FROM savings_goals WHERE id = NEW.goal_id;
    IF goal_owner IS DISTINCT FROM NEW.owner_id THEN
      RAISE EXCEPTION 'goal_owner_mismatch';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_transactions_goal_owner
  BEFORE INSERT OR UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION trg_goal_owner_check();

CREATE TRIGGER trg_movements_goal_owner
  BEFORE INSERT ON savings_movements
  FOR EACH ROW EXECUTE FUNCTION trg_goal_owner_check();

-- Ledger history can never be rewritten (a client cannot inflate a competition score).
CREATE FUNCTION trg_movements_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'savings_ledger_append_only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_movements_no_update
  BEFORE UPDATE ON savings_movements
  FOR EACH ROW EXECUTE FUNCTION trg_movements_append_only();
`,
  },
  {
    id: '003',
    name: 'achievements',
    sql: `
CREATE TABLE achievements (
  id            TEXT PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL,
  milestone_bps INTEGER NOT NULL CHECK (milestone_bps BETWEEN 1 AND 10000),
  badge         TEXT NOT NULL,
  sort_order    INTEGER NOT NULL
);

CREATE TABLE user_achievements (
  id                    UUID PRIMARY KEY,
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id        TEXT NOT NULL REFERENCES achievements(id),
  goal_id               UUID NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
  earned_at             TEXT NOT NULL,
  progress_bps_at_award INTEGER NOT NULL,
  UNIQUE (user_id, achievement_id, goal_id)
);
CREATE INDEX idx_user_achievements_user ON user_achievements(user_id, earned_at DESC);
`,
  },
  {
    id: '004',
    name: 'groups_invitations',
    sql: `
CREATE TABLE private_groups (
  id         UUID PRIMARY KEY,
  name       TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 60),
  owner_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_groups_owner ON private_groups(owner_id);

CREATE TABLE group_members (
  group_id  UUID NOT NULL REFERENCES private_groups(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role      TEXT NOT NULL CHECK (role IN ('owner', 'member')),
  joined_at TEXT NOT NULL,
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX idx_group_members_user ON group_members(user_id);

CREATE TABLE invitation_codes (
  id         UUID PRIMARY KEY,
  group_id   UUID NOT NULL REFERENCES private_groups(id) ON DELETE CASCADE,
  code_hash  TEXT NOT NULL UNIQUE,
  label      TEXT CHECK (label IS NULL OR length(label) <= 40),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT,
  max_uses   INTEGER NOT NULL DEFAULT 1 CHECK (max_uses BETWEEN 1 AND 100),
  uses_count INTEGER NOT NULL DEFAULT 0 CHECK (uses_count >= 0 AND uses_count <= max_uses),
  revoked_at TEXT
);
CREATE INDEX idx_invitation_group ON invitation_codes(group_id);
`,
  },
  {
    id: '005',
    name: 'competitions_and_snapshots',
    sql: `
CREATE TABLE competitions (
  id            UUID PRIMARY KEY,
  name          TEXT NOT NULL CHECK (length(name) BETWEEN 3 AND 80),
  description   TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 280),
  duration_days INTEGER NOT NULL CHECK (duration_days IN (7, 30)),
  visibility    TEXT NOT NULL CHECK (visibility IN ('public', 'private')),
  group_id      UUID REFERENCES private_groups(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed', 'cancelled')),
  starts_at     TEXT NOT NULL,
  ends_at       TEXT NOT NULL,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL,
  finalised_at  TEXT,
  scoring_note  TEXT NOT NULL DEFAULT 'score = 100 × (aktuellt saldo − startsaldo) / låst målbelopp',
  CHECK (ends_at > starts_at),
  CHECK ((visibility = 'public' AND group_id IS NULL) OR (visibility = 'private' AND group_id IS NOT NULL))
);
CREATE INDEX idx_competitions_status_end ON competitions(status, ends_at);
CREATE INDEX idx_competitions_visibility ON competitions(visibility, status, starts_at);
CREATE INDEX idx_competitions_group ON competitions(group_id);

CREATE TABLE competition_participants (
  id                   UUID PRIMARY KEY,
  competition_id       UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_id              UUID NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
  starting_balance_ore BIGINT NOT NULL DEFAULT 0 CHECK (starting_balance_ore >= 0),
  locked_target_ore    BIGINT NOT NULL CHECK (locked_target_ore > 0),
  class_code           TEXT NOT NULL DEFAULT '',
  snapshot_frozen_at   TEXT,
  joined_at            TEXT NOT NULL,
  withdrawn_at         TEXT,
  final_score_centi    BIGINT,
  final_rank           INTEGER,
  UNIQUE (competition_id, user_id)
);
CREATE INDEX idx_participants_competition ON competition_participants(competition_id, withdrawn_at);
CREATE INDEX idx_participants_user ON competition_participants(user_id);
CREATE INDEX idx_participants_goal ON competition_participants(goal_id);

-- Frozen snapshots cannot be rewritten, and a final score/rank can only be written once.
CREATE FUNCTION trg_participant_snapshot_immutable() RETURNS trigger AS $$
BEGIN
  IF OLD.snapshot_frozen_at IS NOT NULL AND (
       NEW.starting_balance_ore IS DISTINCT FROM OLD.starting_balance_ore
    OR NEW.locked_target_ore    IS DISTINCT FROM OLD.locked_target_ore
    OR NEW.class_code           IS DISTINCT FROM OLD.class_code
    OR NEW.goal_id              IS DISTINCT FROM OLD.goal_id
    OR NEW.snapshot_frozen_at IS NULL
  ) THEN
    RAISE EXCEPTION 'locked_snapshot_immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_participants_frozen_snapshot
  BEFORE UPDATE ON competition_participants
  FOR EACH ROW EXECUTE FUNCTION trg_participant_snapshot_immutable();

CREATE FUNCTION trg_participant_final_score_once() RETURNS trigger AS $$
BEGIN
  IF OLD.final_score_centi IS NOT NULL AND (
       NEW.final_score_centi IS DISTINCT FROM OLD.final_score_centi
    OR NEW.final_rank        IS DISTINCT FROM OLD.final_rank
  ) THEN
    RAISE EXCEPTION 'final_score_immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_participants_final_score_once
  BEFORE UPDATE ON competition_participants
  FOR EACH ROW EXECUTE FUNCTION trg_participant_final_score_once();

CREATE FUNCTION trg_competition_finalised_immutable() RETURNS trigger AS $$
BEGIN
  IF OLD.finalised_at IS NOT NULL AND (
       NEW.starts_at    IS DISTINCT FROM OLD.starts_at
    OR NEW.ends_at      IS DISTINCT FROM OLD.ends_at
    OR NEW.status       IS DISTINCT FROM OLD.status
    OR NEW.finalised_at IS DISTINCT FROM OLD.finalised_at
  ) THEN
    RAISE EXCEPTION 'competition_finalised';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_competitions_finalised_immutable
  BEFORE UPDATE ON competitions
  FOR EACH ROW EXECUTE FUNCTION trg_competition_finalised_immutable();
`,
  },
  {
    id: '006',
    name: 'insertion_order',
    sql: `
-- Monotonic insertion order. Timestamps are ISO text and can collide (the test clock can freeze),
-- so ordering by time alone is not stable; the identity column makes list order deterministic.
ALTER TABLE savings_goals ADD COLUMN seq BIGINT GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE transactions ADD COLUMN seq BIGINT GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE savings_movements ADD COLUMN seq BIGINT GENERATED BY DEFAULT AS IDENTITY;
CREATE INDEX idx_goals_seq ON savings_goals(owner_id, seq DESC);
CREATE INDEX idx_movements_seq ON savings_movements(goal_id, seq DESC);
CREATE INDEX idx_transactions_seq ON transactions(owner_id, seq DESC);
`,
  },
];

export const ACHIEVEMENT_SEED = [
  {
    code: 'first_steps',
    name: 'Första steget',
    description: 'Du har sparat 10 % av ditt mål.',
    milestoneBps: 1000,
    badge: '🌱',
    sortOrder: 1,
  },
  {
    code: 'building_momentum',
    name: 'Bygger fart',
    description: 'Du har sparat 25 % av ditt mål.',
    milestoneBps: 2500,
    badge: '🚀',
    sortOrder: 2,
  },
  {
    code: 'halfway_there',
    name: 'Halvvägs',
    description: 'Du har sparat 50 % av ditt mål.',
    milestoneBps: 5000,
    badge: '⛰️',
    sortOrder: 3,
  },
  {
    code: 'nearly_there',
    name: 'Nära nu',
    description: 'Du har sparat 75 % av ditt mål.',
    milestoneBps: 7500,
    badge: '🔥',
    sortOrder: 4,
  },
  {
    code: 'goal_achieved',
    name: 'Mål uppnått',
    description: 'Du har nått hela ditt sparmål.',
    milestoneBps: 10000,
    badge: '🏆',
    sortOrder: 5,
  },
];
