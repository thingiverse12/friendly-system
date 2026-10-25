/**
 * Demo seed for local development and previews.
 *
 *   npm run seed:demo            # creates the demo world if it does not exist
 *   npm run seed:demo -- --force # wipes users created by this script and re-creates them
 *
 * All accounts use the password "SparlyDemo123". Never run this against a production database.
 */
import { openDatabase, type Db } from '../server/src/db.js';
import { config } from '../server/src/config.js';
import { registerUser, updateProfile } from '../server/src/services/accounts.js';
import { createGoal, recordMovement } from '../server/src/services/goals.js';
import { createTransaction } from '../server/src/services/transactions.js';
import {
  createCompetition,
  ensurePublicCompetitions,
  getCompetition,
  joinCompetition,
  syncCompetitionLifecycle,
} from '../server/src/services/competitions.js';
import { createGroup, createInvitation, joinGroupByCode } from '../server/src/services/groups.js';
import { nowMs, toIso, DAY_MS } from '../server/src/lib/time.js';

const PASSWORD = 'SparlyDemo123';
const DEMO_EMAILS = [
  'alex@sparly.se',
  'emma@sparly.se',
  'oskar@sparly.se',
  'frida@sparly.se',
  'lukas@sparly.se',
  'elin@sparly.se',
];

const force = process.argv.includes('--force');

const db = openDatabase();
console.log(`[seed] database ${config.databaseFile}`);

const existing = db
  .prepare(`SELECT COUNT(*) AS count FROM users WHERE email IN (${DEMO_EMAILS.map(() => '?').join(',')})`)
  .get(...DEMO_EMAILS) as { count: number };

if (existing.count > 0 && !force) {
  console.log('[seed] demo accounts already exist — run with --force to recreate them.');
  printLogins();
  db.close();
  process.exit(0);
}

if (existing.count > 0) {
  db.pragma('foreign_keys = ON');
  db.transaction(() => {
    db.prepare(`DELETE FROM users WHERE email IN (${DEMO_EMAILS.map(() => '?').join(',')})`).run(...DEMO_EMAILS);
    db.prepare(`DELETE FROM private_groups WHERE name IN ('Vännernas gäng', 'SparaSmart')`).run();
    db.prepare(`DELETE FROM competitions WHERE name LIKE 'Demotävling%'`).run();
  })();
  console.log('[seed] removed previous demo accounts');
}

interface Account {
  id: string;
  email: string;
  goalIds: Record<string, string>;
}

async function makeUser(email: string, alias: string, consent = true): Promise<Account> {
  const { userId } = await registerUser(db, {
    email,
    password: PASSWORD,
    alias,
    timezone: 'Europe/Stockholm',
    publicCompetitionConsent: consent,
    shareBadges: true,
  });
  return { id: userId, email, goalIds: {} };
}

function goal(account: Account, name: string, targetOre: number, balanceOre: number): string {
  const created = createGoal(db, account.id, { name, targetAmountOre: targetOre, privacy: 'private' });
  account.goalIds[name] = created.id;
  if (balanceOre > 0) {
    recordMovement(db, account.id, created.id, {
      type: 'deposit',
      amountOre: balanceOre,
      note: 'Startsaldo',
      occurredAt: toIso(nowMs() - 40 * DAY_MS),
    });
  }
  return created.id;
}

function save(account: Account, goalName: string, amountOre: number, daysAgo: number, note?: string): void {
  recordMovement(db, account.id, account.goalIds[goalName]!, {
    type: 'deposit',
    amountOre,
    note: note ?? 'Månadssparande',
    occurredAt: toIso(nowMs() - daysAgo * DAY_MS),
  });
}

function spend(account: Account, goalName: string, amountOre: number, daysAgo: number, note?: string): void {
  recordMovement(db, account.id, account.goalIds[goalName]!, {
    type: 'withdrawal',
    amountOre,
    note: note ?? 'Uttag',
    occurredAt: toIso(nowMs() - daysAgo * DAY_MS),
  });
}

function transaction(
  account: Account,
  type: 'income' | 'expense',
  amountOre: number,
  category: string,
  daysAgo: number,
  description?: string,
  goalName?: string,
): void {
  createTransaction(db, account.id, {
    type,
    amountOre,
    category,
    description: description ?? null,
    goalId: goalName ? account.goalIds[goalName] : null,
    occurredAt: toIso(nowMs() - daysAgo * DAY_MS),
  });
}

function printLogins(): void {
  console.log('\n  Demo accounts (password: SparlyDemo123)');
  for (const email of DEMO_EMAILS) console.log(`   • ${email}`);
  console.log('');
}

const alex = await makeUser('alex@sparly.se', 'sparlygd_123');
const emma = await makeUser('emma@sparly.se', 'Sparglad_Emma');
const oskar = await makeUser('oskar@sparly.se', 'EkonomiskOlle');
const frida = await makeUser('frida@sparly.se', 'FramtidsFia');
const lukas = await makeUser('lukas@sparly.se', 'LugnLukas');
const elin = await makeUser('elin@sparly.se', 'EkonomiEllen');

// ---- Alex's savings world -------------------------------------------------
goal(alex, 'Buffert', 4_000_000, 800_000);
goal(alex, 'Nytt kök', 1_500_000, 200_000);
goal(alex, 'Drömresan', 2_500_000, 1_000_000); // newest goal, shown first

save(alex, 'Drömresan', 248_000, 30, 'Månadssparande');
save(alex, 'Drömresan', 250_000, 12, 'Extra efter löning');
save(alex, 'Nytt kök', 120_000, 20, 'Kökssparande');
spend(alex, 'Buffert', 200_000, 8, 'Ny cykel');

transaction(alex, 'income', 2_850_000, 'Lön', 12, 'Lön september');
transaction(alex, 'expense', 62_000, 'Mat', 11, 'Veckohandling');
transaction(alex, 'expense', 85_000, 'Transport', 10, 'Bensin');
transaction(alex, 'expense', 100_000, 'Övrig utgift', 9, 'Sparande till resa', 'Drömresan');
transaction(alex, 'expense', 32_000, 'Nöje', 7, 'Restaurang');
transaction(alex, 'income', 40_000, 'Bidrag', 6, 'Barnbidrag');
transaction(alex, 'expense', 149_000, 'Boende', 5, 'Hyra');
transaction(alex, 'expense', 24_900, 'Prenumerationer', 3, 'Streaming');

save(alex, 'Drömresan', 250_000, 2, 'Veckans sparmål');

// ---- Friends --------------------------------------------------------------
goal(emma, 'Interrail', 2_000_000, 1_400_000);
save(emma, 'Interrail', 180_000, 9);
goal(oskar, 'Elcykel', 1_200_000, 200_000);
save(oskar, 'Elcykel', 300_000, 6);
goal(frida, 'Handpenning', 6_000_000, 2_400_000);
save(frida, 'Handpenning', 400_000, 20);
goal(lukas, 'Gaming-PC', 1_400_000, 300_000);
save(lukas, 'Gaming-PC', 150_000, 5);
goal(elin, 'Studieresa', 800_000, 500_000);
save(elin, 'Studieresa', 150_000, 4);

for (const account of [emma, oskar, frida]) {
  transaction(account, 'income', 2_500_000 + Math.round(Math.random() * 500_000), 'Lön', 12, 'Månadslön');
  transaction(account, 'expense', 180_000 + Math.round(Math.random() * 400_000), 'Boende', 10, 'Boendekostnad');
}

// updateProfile is used for one account to demonstrate privacy settings
updateProfile(db, emma.id, { publicCompetitionConsent: true, shareBadges: true });

// ---- Competitions ---------------------------------------------------------
ensurePublicCompetitions(db);

const sevenDay = db
  .prepare(
    `SELECT id FROM competitions WHERE visibility = 'public' AND duration_days = 7 AND status IN ('upcoming','active')
     ORDER BY starts_at ASC LIMIT 1`,
  )
  .get() as { id: string } | undefined;

syncCompetitionLifecycle(db);

if (!sevenDay) throw new Error('Ingen offentlig 7-dagarstävling hittades');
const publicCompetitionId = sevenDay.id;

const joiners: Array<[Account, string]> = [
  [alex, 'Drömresan'],
  [emma, 'Interrail'],
  [oskar, 'Elcykel'],
  [frida, 'Handpenning'],
  [lukas, 'Gaming-PC'],
  [elin, 'Studieresa'],
];

for (const [account, goalName] of joiners) {
  try {
    joinCompetition(db, account.id, publicCompetitionId, { goalId: account.goalIds[goalName]! });
  } catch (error) {
    console.log(`[seed] skip join for ${account.email}: ${(error as Error).message}`);
  }
}

// Deposits after the competition started create the visible score spread.
save(alex, 'Drömresan', 120_000, 0, 'Tävlingsspurt');
save(emma, 'Interrail', 90_000, 0, 'Tävlingsspurt');
save(oskar, 'Elcykel', 30_000, 0, 'Tävlingsspurt');
save(frida, 'Handpenning', 150_000, 0, 'Tävlingsspurt');

// A finished 7-day competition with frozen final results.
const finished = createCompetition(db, {
  name: 'Demotävling – avslutad vecka',
  description: 'En avslutad tävling som visar hur slutresultatet låses.',
  durationDays: 7,
  visibility: 'public',
  startsAt: toIso(nowMs() - 9 * DAY_MS),
  createdBy: alex.id,
});
// Open it temporarily so participants can be snapshotted, then close it in the past.
db.prepare("UPDATE competitions SET status = 'active', ends_at = ? WHERE id = ?").run(
  toIso(nowMs() + 5 * DAY_MS),
  finished.id,
);
for (const [account, goalName] of joiners.slice(0, 4)) {
  joinCompetition(db, account.id, finished.id, { goalId: account.goalIds[goalName]! });
}
db.prepare('UPDATE competitions SET ends_at = ? WHERE id = ?').run(toIso(nowMs() - 2 * DAY_MS), finished.id);
save(alex, 'Drömresan', 60_000, 8, 'Tävlingsinsats');
syncCompetitionLifecycle(db);

// ---- Private group --------------------------------------------------------
const group = createGroup(db, alex.id, 'Vännernas gäng');
const invitation = createInvitation(db, alex.id, group.id, { maxUses: 5, expiresInHours: 24 * 30, label: 'Demoinbjudan' });
for (const account of [emma, oskar]) {
  joinGroupByCode(db, account.id, invitation.code);
}

const groupCompetition = createCompetition(db, {
  name: 'Vännernas 7-dagars',
  description: 'Privat tävling i gruppen – bara medlemmar ser topplistan.',
  durationDays: 7,
  visibility: 'private',
  groupId: group.id,
  startsAt: toIso(nowMs()),
  createdBy: alex.id,
});
joinCompetition(db, alex.id, groupCompetition.id, { goalId: alex.goalIds['Drömresan']! });
joinCompetition(db, emma.id, groupCompetition.id, { goalId: emma.goalIds['Interrail']! });

// Start the group competition and freeze its snapshots.
syncCompetitionLifecycle(db);

printLogins();
console.log(`  Inbjudningskod till "Vännernas gäng": ${invitation.code}`);
console.log(`  Aktiv offentlig tävling: ${publicCompetitionId}`);
console.log('  Klart! Logga in och utforska.\n');

db.close();
process.exit(0);
