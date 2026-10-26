// Kostnadskontroll: timkvoter per användare och rum. AI-budgetar får aldrig skapa betalväggar –
// när kvoten är nådd går systemet över till den kostnadsfria lokala motorn.
import { run, getOne } from '../db.js';
import { config } from '../config.js';

function hourBucket() {
  return new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
}

function bump(scope, scopeId) {
  const period = hourBucket();
  run(
    `INSERT INTO usage_budgets (id, scope, scope_id, period, ai_calls)
     VALUES (lower(hex(randomblob(8))), ?, ?, ?, 1)
     ON CONFLICT(scope, scope_id, period) DO UPDATE SET ai_calls = ai_calls + 1`,
    [scope, scopeId, period],
  );
}

export function budgetStatus(userId, roomId) {
  const period = hourBucket();
  const userRow = getOne('SELECT ai_calls FROM usage_budgets WHERE scope = ? AND scope_id = ? AND period = ?',
    ['user', userId, period]);
  const roomRow = getOne('SELECT ai_calls FROM usage_budgets WHERE scope = ? AND scope_id = ? AND period = ?',
    ['room', roomId, period]);
  return {
    userCalls: userRow?.ai_calls || 0,
    userCap: config.budgets.aiCallsPerUserPerHour,
    roomCalls: roomRow?.ai_calls || 0,
    roomCap: config.budgets.aiCallsPerRoomPerHour,
  };
}

export function tryConsumeBudget(userId, roomId) {
  const status = budgetStatus(userId, roomId);
  if (status.userCalls >= status.userCap || status.roomCalls >= status.roomCap) {
    return { allowed: false, status };
  }
  bump('user', userId);
  bump('room', roomId);
  return { allowed: true, status: budgetStatus(userId, roomId) };
}
