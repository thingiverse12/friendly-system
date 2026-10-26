// Databaslager ovanpå Node's inbyggda SQLite (node:sqlite).
// Normaliserat, versionsmedvetet schema. Hemliga facit ligger i separata tabeller
// som aldrig exponeras via publika API:er.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { DB_PATH, DATA_DIR } from './config.js';

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA busy_timeout = 5000;');

function col(name, type, extra = '') {
  return `${name} ${type} ${extra}`;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  settings TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  is_private INTEGER NOT NULL DEFAULT 1,
  bio TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
-- Series grupperar versioner av samma fall (versionslåsning).
CREATE TABLE IF NOT EXISTS case_series (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY,
  series_id TEXT NOT NULL REFERENCES case_series(id),
  version INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  intro TEXT NOT NULL,
  case_type TEXT NOT NULL,
  environment TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  playtime_min INTEGER NOT NULL DEFAULT 60,
  language TEXT NOT NULL DEFAULT 'sv',
  status TEXT NOT NULL DEFAULT 'draft',            -- draft|in_review|approved|unpublished|reredview
  locked INTEGER NOT NULL DEFAULT 0,
  official INTEGER NOT NULL DEFAULT 0,
  creator_id TEXT REFERENCES users(id),
  public_payload TEXT NOT NULL DEFAULT '{}',       -- offentligt material (tryggt att skicka till klient)
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(series_id, version)
);
CREATE TABLE IF NOT EXISTS case_suspects (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  public_profile TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS case_suspect_secrets (
  suspect_row_id TEXT PRIMARY KEY REFERENCES case_suspects(id) ON DELETE CASCADE,
  secret_model TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS case_events (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  event_time TEXT NOT NULL,
  label TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'confirmed',          -- confirmed|claimed|uncertain
  is_public INTEGER NOT NULL DEFAULT 1,
  secret_note TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS case_evidence (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  source_status TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL DEFAULT '',
  discover_hint TEXT NOT NULL DEFAULT '',
  secret_meaning TEXT NOT NULL DEFAULT ''          -- enbart serversidan
);
CREATE TABLE IF NOT EXISTS case_witness_statements (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL,
  content TEXT NOT NULL,
  reliability TEXT NOT NULL DEFAULT 'medium'
);
CREATE TABLE IF NOT EXISTS case_solution_secrets (
  case_id TEXT PRIMARY KEY REFERENCES cases(id) ON DELETE CASCADE,
  culprit_id TEXT NOT NULL,
  motive TEXT NOT NULL,
  narrative TEXT NOT NULL,
  real_timeline TEXT NOT NULL DEFAULT '[]',
  decisive_evidence TEXT NOT NULL DEFAULT '[]',
  alternative_explanations TEXT NOT NULL DEFAULT '[]',
  locked INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS case_validation_runs (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  passed INTEGER NOT NULL,
  report TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS case_validation_findings (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES case_validation_runs(id) ON DELETE CASCADE,
  severity TEXT NOT NULL,
  code TEXT NOT NULL,
  message TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS campaign_cases (
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  PRIMARY KEY (campaign_id, case_id)
);
CREATE TABLE IF NOT EXISTS campaign_progress (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  current_ordinal INTEGER NOT NULL DEFAULT 1,
  decisions TEXT NOT NULL DEFAULT '[]',
  completed_cases TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, campaign_id)
);
CREATE TABLE IF NOT EXISTS investigation_rooms (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  host_id TEXT NOT NULL REFERENCES users(id),
  case_id TEXT NOT NULL REFERENCES cases(id),
  case_version INTEGER NOT NULL,
  mode TEXT NOT NULL DEFAULT 'solo',              -- solo|cooperative|competitive
  score_system TEXT NOT NULL DEFAULT 'realistic',
  guess_limit INTEGER NOT NULL DEFAULT 0,          -- 0 = obegränsat
  hint_rules TEXT NOT NULL DEFAULT 'on',
  difficulty TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',            -- open|in_progress|finished|closed
  settings TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS room_members (
  room_id TEXT NOT NULL REFERENCES investigation_rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_role TEXT NOT NULL DEFAULT 'player',     -- host|player
  status TEXT NOT NULL DEFAULT 'active',          -- active|offline|removed
  joined_at TEXT NOT NULL,
  PRIMARY KEY (room_id, user_id)
);
CREATE TABLE IF NOT EXISTS investigation_sessions (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES investigation_rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active',          -- active|solved|abandoned
  started_at TEXT NOT NULL,
  finished_at TEXT
);
CREATE TABLE IF NOT EXISTS session_events (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES investigation_rooms(id) ON DELETE CASCADE,
  actor_id TEXT REFERENCES users(id),
  seq INTEGER NOT NULL,
  type TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  idempotency_key TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(room_id, idempotency_key)
);
CREATE TABLE IF NOT EXISTS discovered_evidence (
  room_id TEXT NOT NULL REFERENCES investigation_rooms(id) ON DELETE CASCADE,
  evidence_id TEXT NOT NULL,
  discovered_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  PRIMARY KEY (room_id, evidence_id)
);
CREATE TABLE IF NOT EXISTS interrogations (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES investigation_rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  suspect_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS interrogation_messages (
  id TEXT PRIMARY KEY,
  interrogation_id TEXT NOT NULL REFERENCES interrogations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,                              -- player|suspect|system
  content TEXT NOT NULL,
  evidence_id TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS player_notes (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES investigation_rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'note',               -- note|theory|question|contradiction
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS evidence_connections (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES investigation_rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  node_a TEXT NOT NULL,
  node_b TEXT NOT NULL,
  motivation TEXT NOT NULL DEFAULT '',
  classification TEXT NOT NULL DEFAULT 'unsupported',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS final_accusations (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES investigation_rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  suspect_id TEXT NOT NULL,
  motive TEXT NOT NULL DEFAULT '',
  evidence_ids TEXT NOT NULL DEFAULT '[]',
  narrative TEXT NOT NULL DEFAULT '',
  correct INTEGER NOT NULL,
  score_detail TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS score_events (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES investigation_rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  points INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS community_ratings (
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK(score BETWEEN 1 AND 5),
  created_at TEXT NOT NULL,
  PRIMARY KEY (case_id, user_id)
);
CREATE TABLE IF NOT EXISTS favorites (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, case_id)
);
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  spoiler INTEGER NOT NULL DEFAULT 0,
  hidden INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL,                       -- case|comment|user
  target_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS moderation_actions (
  id TEXT PRIMARY KEY,
  moderator_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  action TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT '',
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS privacy_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                              -- export|delete
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS usage_budgets (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  scope TEXT NOT NULL,                             -- user|room
  scope_id TEXT NOT NULL,
  period TEXT NOT NULL,                            -- timmesbucket 'YYYY-MM-DDTHH'
  ai_calls INTEGER NOT NULL DEFAULT 0,
  UNIQUE(scope, scope_id, period)
);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status, official);
CREATE INDEX IF NOT EXISTS idx_events_room ON session_events(room_id, seq);
CREATE INDEX IF NOT EXISTS idx_notes_room ON player_notes(room_id, user_id);
CREATE INDEX IF NOT EXISTS idx_messages_interr ON interrogation_messages(interrogation_id);
`;

db.exec(SCHEMA);

// --- små hjälpare ---
export function now() {
  return new Date().toISOString();
}

// node:sqlite binder positionella parametrar via argument (inte array) och namngivna via objekt.
export function getOne(sql, params = []) {
  return Array.isArray(params) ? db.prepare(sql).get(...params) : db.prepare(sql).get(params);
}
export function getAll(sql, params = []) {
  return Array.isArray(params) ? db.prepare(sql).all(...params) : db.prepare(sql).all(params);
}
export function run(sql, params = []) {
  return Array.isArray(params) ? db.prepare(sql).run(...params) : db.prepare(sql).run(params);
}

export function parseJson(row, ...keys) {
  if (!row) return row;
  for (const key of keys) {
    if (typeof row[key] === 'string') {
      try { row[key] = JSON.parse(row[key]); } catch { row[key] = null; }
    }
  }
  return row;
}

// node:sqlite saknar better-sqlite3's transaction-hjälpare – implementera med BEGIN/SAVEPOINT.
let txDepth = 0;
export function transaction(fn) {
  if (txDepth === 0) {
    txDepth++;
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      db.exec('COMMIT');
      txDepth--;
      return result;
    } catch (err) {
      try { db.exec('ROLLBACK'); } catch { /* redan återställd */ }
      txDepth = 0;
      throw err;
    }
  }
  const savepoint = `sp_${txDepth}`;
  txDepth++;
  db.exec(`SAVEPOINT ${savepoint}`);
  try {
    const result = fn();
    db.exec(`RELEASE SAVEPOINT ${savepoint}`);
    txDepth--;
    return result;
  } catch (err) {
    try { db.exec(`ROLLBACK TO SAVEPOINT ${savepoint}`); db.exec(`RELEASE SAVEPOINT ${savepoint}`); } catch { /* ignorera */ }
    txDepth--;
    throw err;
  }
}
