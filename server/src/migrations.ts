/**
 * Reproducible schema migrations. Each entry is applied once, in order, inside a transaction,
 * and recorded in schema_migrations. No ORM magic: plain parameterised SQL only.
 *
 * Money is stored as INTEGER öre everywhere. Scores are stored as INTEGER centi-points
 * (1/100 point) so scoring is exact and never floating point.
 */

export interface Migration {
  id: string;
  name: string;
  sql: string;
}

export const migrations: Migration[] = [
  {
    id: '001',
    name: 'core_accounts_and_sessions',
    sql: `
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_algo TEXT NOT NULL DEFAULT 'argon2id',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT
);

CREATE TABLE profiles (
  user_id                     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  alias                       TEXT NOT NULL CHECK (length(alias) BETWEEN 3 AND 24),
  alias_normalized            TEXT NOT NULL UNIQUE,
  timezone                    TEXT NOT NULL DEFAULT 'Europe/Stockholm',
  public_competition_consent  INTEGER NOT NULL DEFAULT 0 CHECK (public_competition_consent IN (0, 1)),
  share_badges                INTEGER NOT NULL DEFAULT 0 CHECK (share_badges IN (0, 1)),
  created_at                  TEXT NOT NULL,
  updated_at                  TEXT NOT NULL
);

CREATE TABLE sessions (
  id           TEXT PRIMARY KEY,               -- sha256(token), the raw token only lives in the cookie
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

CREATE TABLE password_reset_tokens (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at    TEXT
);
CREATE INDEX idx_reset_user ON password_reset_tokens(user_id);

CREATE TABLE audit_events (
  id            TEXT PRIMARY KEY,
  actor_user_id TEXT,
  event         TEXT NOT NULL,
  target        TEXT,
  metadata      TEXT,
  created_at    TEXT NOT NULL
);
CREATE INDEX idx_audit_actor ON audit_events(actor_user_id);

CREATE TABLE rate_limits (
  key          TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL CHECK (count >= 0),
  PRIMARY KEY (key, window_start)
);
`,
  },
  {
    id: '002',
    name: 'savings_goals_transactions_ledger',
    sql: `
CREATE TABLE savings_goals (
  id               TEXT PRIMARY KEY,
  owner_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name             TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  target_amount_ore INTEGER NOT NULL CHECK (target_amount_ore > 0 AND target_amount_ore <= 100000000000),
  balance_ore      INTEGER NOT NULL DEFAULT 0 CHECK (balance_ore >= 0 AND balance_ore <= 100000000000),
  currency         TEXT NOT NULL DEFAULT 'SEK' CHECK (currency = 'SEK'),
  privacy          TEXT NOT NULL DEFAULT 'private' CHECK (privacy IN ('private', 'alias_visible')),
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  archived_at      TEXT
);
CREATE INDEX idx_goals_owner ON savings_goals(owner_id, archived_at);
CREATE INDEX idx_goals_owner_created ON savings_goals(owner_id, created_at);

CREATE TABLE transactions (
  id           TEXT PRIMARY KEY,
  owner_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_id      TEXT REFERENCES savings_goals(id) ON DELETE SET NULL,
  type         TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount_ore   INTEGER NOT NULL CHECK (amount_ore > 0 AND amount_ore <= 100000000000),
  category     TEXT NOT NULL CHECK (length(category) BETWEEN 1 AND 40),
  description  TEXT CHECK (description IS NULL OR length(description) <= 280),
  occurred_at  TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX idx_transactions_owner_occurred ON transactions(owner_id, occurred_at DESC);
CREATE INDEX idx_transactions_goal ON transactions(goal_id);

-- A transaction may only reference a goal owned by the same user.
CREATE TRIGGER trg_transactions_goal_owner_insert
BEFORE INSERT ON transactions
WHEN NEW.goal_id IS NOT NULL
 AND (SELECT owner_id FROM savings_goals WHERE id = NEW.goal_id) IS NOT NEW.owner_id
BEGIN
  SELECT RAISE(ABORT, 'goal_owner_mismatch');
END;

CREATE TRIGGER trg_transactions_goal_owner_update
BEFORE UPDATE ON transactions
WHEN NEW.goal_id IS NOT NULL
 AND (SELECT owner_id FROM savings_goals WHERE id = NEW.goal_id) IS NOT NEW.owner_id
BEGIN
  SELECT RAISE(ABORT, 'goal_owner_mismatch');
END;

-- Append-only ledger of savings deposits/withdrawals. Income never lands here automatically.
CREATE TABLE savings_movements (
  id               TEXT PRIMARY KEY,
  owner_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_id          TEXT NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
  type             TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal')),
  amount_ore       INTEGER NOT NULL CHECK (amount_ore > 0 AND amount_ore <= 100000000000),
  balance_after_ore INTEGER NOT NULL CHECK (balance_after_ore >= 0),
  note             TEXT CHECK (note IS NULL OR length(note) <= 280),
  occurred_at      TEXT NOT NULL,
  created_at       TEXT NOT NULL
);
CREATE INDEX idx_movements_owner ON savings_movements(owner_id, occurred_at);
CREATE INDEX idx_movements_goal ON savings_movements(goal_id, occurred_at);

CREATE TRIGGER trg_movements_goal_owner
BEFORE INSERT ON savings_movements
WHEN (SELECT owner_id FROM savings_goals WHERE id = NEW.goal_id) IS NOT NEW.owner_id
BEGIN
  SELECT RAISE(ABORT, 'goal_owner_mismatch');
END;

-- Ledger entries are immutable: history cannot be rewritten to fake a competition score.
CREATE TRIGGER trg_movements_no_update
BEFORE UPDATE ON savings_movements
BEGIN
  SELECT RAISE(ABORT, 'savings_ledger_append_only');
END;
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
  id                    TEXT PRIMARY KEY,
  user_id               TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id        TEXT NOT NULL REFERENCES achievements(id),
  goal_id               TEXT NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
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
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 60),
  owner_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_groups_owner ON private_groups(owner_id);

CREATE TABLE group_members (
  group_id  TEXT NOT NULL REFERENCES private_groups(id) ON DELETE CASCADE,
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role      TEXT NOT NULL CHECK (role IN ('owner', 'member')),
  joined_at TEXT NOT NULL,
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX idx_group_members_user ON group_members(user_id);

CREATE TABLE invitation_codes (
  id         TEXT PRIMARY KEY,
  group_id   TEXT NOT NULL REFERENCES private_groups(id) ON DELETE CASCADE,
  code_hash  TEXT NOT NULL UNIQUE,          -- sha256 of the plaintext code, never the code itself
  label      TEXT CHECK (label IS NULL OR length(label) <= 40),
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL CHECK (length(name) BETWEEN 3 AND 80),
  description    TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 280),
  duration_days  INTEGER NOT NULL CHECK (duration_days IN (7, 30)),
  visibility     TEXT NOT NULL CHECK (visibility IN ('public', 'private')),
  group_id       TEXT REFERENCES private_groups(id) ON DELETE CASCADE,
  status         TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed', 'cancelled')),
  starts_at      TEXT NOT NULL,
  ends_at        TEXT NOT NULL,
  created_by     TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at     TEXT NOT NULL,
  finalised_at   TEXT,
  scoring_note   TEXT NOT NULL DEFAULT 'score = 100 × (aktuellt saldo − startsaldo) / låst målbelopp',
  CHECK (ends_at > starts_at),
  CHECK ((visibility = 'public' AND group_id IS NULL) OR (visibility = 'private' AND group_id IS NOT NULL))
);
CREATE INDEX idx_competitions_status_end ON competitions(status, ends_at);
CREATE INDEX idx_competitions_visibility ON competitions(visibility, status, starts_at);
CREATE INDEX idx_competitions_group ON competitions(group_id);

CREATE TABLE competition_participants (
  id                   TEXT PRIMARY KEY,
  competition_id       TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  user_id              TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_id              TEXT NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
  starting_balance_ore INTEGER NOT NULL DEFAULT 0 CHECK (starting_balance_ore >= 0),
  locked_target_ore    INTEGER NOT NULL CHECK (locked_target_ore > 0),
  class_code           TEXT NOT NULL DEFAULT '',
  snapshot_frozen_at   TEXT,                -- NULL means "will be snapshotted when the competition starts"
  joined_at            TEXT NOT NULL,
  withdrawn_at         TEXT,
  final_score_centi    INTEGER,
  final_rank           INTEGER,
  UNIQUE (competition_id, user_id)
);
CREATE INDEX idx_participants_competition ON competition_participants(competition_id, withdrawn_at);
CREATE INDEX idx_participants_user ON competition_participants(user_id);
CREATE INDEX idx_participants_goal ON competition_participants(goal_id);

-- Frozen starting snapshots can never be rewritten through an UPDATE, and a player may only
-- write a final score/rank once (server-side finalisation).
CREATE TRIGGER trg_participants_frozen_snapshot
BEFORE UPDATE ON competition_participants
WHEN OLD.snapshot_frozen_at IS NOT NULL
 AND (
      NEW.starting_balance_ore IS NOT OLD.starting_balance_ore
   OR NEW.locked_target_ore    IS NOT OLD.locked_target_ore
   OR NEW.class_code           IS NOT OLD.class_code
   OR NEW.goal_id              IS NOT OLD.goal_id
   OR NEW.snapshot_frozen_at   IS NULL
 )
BEGIN
  SELECT RAISE(ABORT, 'locked_snapshot_immutable');
END;

CREATE TRIGGER trg_participants_final_score_once
BEFORE UPDATE OF final_score_centi, final_rank ON competition_participants
WHEN OLD.final_score_centi IS NOT NULL
 AND (NEW.final_score_centi IS NOT OLD.final_score_centi OR NEW.final_rank IS NOT OLD.final_rank)
BEGIN
  SELECT RAISE(ABORT, 'final_score_immutable');
END;

CREATE TRIGGER trg_competitions_finalised_immutable
BEFORE UPDATE ON competitions
WHEN OLD.finalised_at IS NOT NULL
 AND (NEW.starts_at IS NOT OLD.starts_at OR NEW.ends_at IS NOT OLD.ends_at
      OR NEW.status IS NOT OLD.status OR NEW.finalised_at IS NOT OLD.finalised_at)
BEGIN
  SELECT RAISE(ABORT, 'competition_finalised');
END;
`,
  },
];

export const ACHIEVEMENT_SEED: Array<{
  code: string;
  name: string;
  description: string;
  milestoneBps: number;
  badge: string;
  sortOrder: number;
}> = [
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
