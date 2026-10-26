import type { Db } from '../db.js';
import { badRequest, notFound } from '../lib/errors.js';
import { uuid } from '../lib/ids.js';
import { nowIso, nowMs } from '../lib/time.js';
import { createTransaction } from './transactions.js';

/**
 * Recurring income and expenses.
 *
 * A rule only describes the schedule; every occurrence it produces is an ordinary row in
 * `transactions`. Reports, monthly summaries and the savings ledger therefore keep exactly one
 * source of truth, and turning a rule off never rewrites history.
 *
 * Catch-up is idempotent: `recurring_bookings` has UNIQUE(rule_id, occurrence_date), so opening the
 * app twice, or two requests racing each other, can never book the same month twice. Missed months
 * (the app was not opened) are booked on the next visit, each with its own correct date.
 */

export type RecurrenceInterval = 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export const INTERVALS: readonly RecurrenceInterval[] = ['weekly', 'monthly', 'quarterly', 'yearly'];

const STEP_MONTHS: Record<Exclude<RecurrenceInterval, 'weekly'>, number> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
};

/** Hard ceiling per run so a rule that has been paused for years cannot flood the ledger. */
const MAX_BOOKINGS_PER_RUN = 36;

/* ------------------------------ calendar math ----------------------------- */

/** `YYYY-MM-DD` helpers. Calendar dates are plain strings: no timezone drift, sortable, exact. */
export function isDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
}

export function isMonthString(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function parseDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  return formatDate(new Date(parseDate(date).getTime() + days * 86_400_000));
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
function isoWeekday(date: string): number {
  const day = parseDate(date).getUTCDay();
  return day === 0 ? 7 : day;
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** 1-based day clamped to the month, so "den 31:a" becomes the 30th in April instead of disappearing. */
function clampedDate(year: number, monthIndex: number, day: number): string {
  const safeDay = Math.min(day, daysInMonth(year, monthIndex));
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
}

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** Calendar date "today" in the user's own timezone, which is what a recurring rule means by today. */
export function localToday(timezone: string, ms = nowMs()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toISOString().slice(0, 10);
  }
}

/* --------------------------------- schedule ------------------------------- */

export interface Schedule {
  interval: RecurrenceInterval;
  startDate: string;
  dayOfMonth: number;
  weekday: number;
}

/** First occurrence at or after `from` (inclusive when `inclusive` is true). */
export function occurrenceAtOrAfter(schedule: Schedule, from: string, inclusive = true): string {
  const wanted = inclusive ? from : addDays(from, 1);
  if (schedule.interval === 'weekly') {
    const offset = (schedule.weekday - isoWeekday(schedule.startDate) + 7) % 7;
    const first = addDays(schedule.startDate, offset);
    if (first >= wanted) return first;
    const weeks = Math.ceil((parseDate(wanted).getTime() - parseDate(first).getTime()) / (7 * 86_400_000));
    return addDays(first, weeks * 7);
  }

  const step = STEP_MONTHS[schedule.interval];
  const start = parseDate(schedule.startDate);
  const startIndex = start.getUTCFullYear() * 12 + start.getUTCMonth();
  const target = parseDate(wanted);
  const targetIndex = target.getUTCFullYear() * 12 + target.getUTCMonth();
  let stepNumber = Math.max(0, Math.floor((targetIndex - startIndex) / step));
  // The clamped day can land before `wanted` even in the right month, so walk forward a little.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const index = startIndex + (stepNumber + attempt) * step;
    const candidate = clampedDate(Math.floor(index / 12), index % 12, schedule.dayOfMonth);
    if (candidate >= wanted) return candidate;
  }
  const index = startIndex + (stepNumber + 4) * step;
  return clampedDate(Math.floor(index / 12), index % 12, schedule.dayOfMonth);
}

/** Next occurrence strictly after `date`, or null when the rule's end month has been passed. */
export function nextOccurrence(schedule: Schedule, date: string, endMonth: string | null): string | null {
  const next = occurrenceAtOrAfter(schedule, date, false);
  if (endMonth && monthOf(next) > endMonth) return null;
  return next;
}

/** The next `count` dates a rule will book, for the preview in the UI. */
export function upcomingDates(
  schedule: Schedule,
  endMonth: string | null,
  today: string,
  count = 3,
): string[] {
  const dates: string[] = [];
  let cursor = today;
  for (let i = 0; i < count; i += 1) {
    const next = nextOccurrence(schedule, cursor, endMonth);
    if (!next) break;
    dates.push(next);
    cursor = next;
  }
  return dates;
}

/** What the rule costs (or pays) in an average month, in öre — the number people budget with. */
export function monthlyEquivalentOre(amountOre: number, interval: RecurrenceInterval): number {
  switch (interval) {
    case 'weekly':
      return Math.round((amountOre * 52) / 12);
    case 'quarterly':
      return Math.round(amountOre / 3);
    case 'yearly':
      return Math.round(amountOre / 12);
    default:
      return amountOre;
  }
}

/* ----------------------------------- views -------------------------------- */

export interface RecurringRuleRow {
  id: string;
  owner_id: string;
  type: 'income' | 'expense';
  amount_ore: number;
  category: string;
  description: string | null;
  interval: RecurrenceInterval;
  start_date: string;
  day_of_month: number | null;
  weekday: number | null;
  end_month: string | null;
  next_occurrence: string;
  active: number;
  created_at: string;
  updated_at: string;
  times_booked: number;
  total_booked_ore: number;
  last_booked_date: string | null;
}

export interface RecurringRuleView {
  id: string;
  type: 'income' | 'expense';
  amountOre: number;
  category: string;
  description: string | null;
  interval: RecurrenceInterval;
  startDate: string;
  dayOfMonth: number | null;
  weekday: number | null;
  endMonth: string | null;
  nextOccurrence: string | null;
  upcoming: string[];
  active: boolean;
  monthlyOre: number;
  timesBooked: number;
  totalBookedOre: number;
  lastBookedDate: string | null;
  createdAt: string;
}

export interface RecurringSummary {
  monthlyIncomeOre: number;
  monthlyExpenseOre: number;
  monthlyNetOre: number;
  yearlyExpenseOre: number;
  activeCount: number;
  pausedCount: number;
  bookedThisMonthOre: number;
  bookedThisMonthCount: number;
}

const SELECT = `
  SELECT r.*,
         (SELECT COUNT(*) FROM recurring_bookings b WHERE b.rule_id = r.id) AS times_booked,
         (SELECT COALESCE(SUM(b.amount_ore), 0) FROM recurring_bookings b WHERE b.rule_id = r.id) AS total_booked_ore,
         (SELECT MAX(b.occurrence_date) FROM recurring_bookings b WHERE b.rule_id = r.id) AS last_booked_date
  FROM recurring_rules r`;

function scheduleOf(row: RecurringRuleRow): Schedule {
  return {
    interval: row.interval,
    startDate: row.start_date,
    dayOfMonth: row.day_of_month ?? Number(row.start_date.slice(8, 10)),
    weekday: row.weekday ?? isoWeekday(row.start_date),
  };
}

function toView(row: RecurringRuleRow, today: string): RecurringRuleView {
  const schedule = scheduleOf(row);
  const active = row.active === 1;
  return {
    id: row.id,
    type: row.type,
    amountOre: row.amount_ore,
    category: row.category,
    description: row.description,
    interval: row.interval,
    startDate: row.start_date,
    dayOfMonth: row.day_of_month,
    weekday: row.weekday,
    endMonth: row.end_month,
    nextOccurrence: active ? row.next_occurrence : null,
    upcoming: active ? upcomingDates(schedule, row.end_month, today) : [],
    active,
    monthlyOre: monthlyEquivalentOre(row.amount_ore, row.interval),
    timesBooked: Number(row.times_booked ?? 0),
    totalBookedOre: Number(row.total_booked_ore ?? 0),
    lastBookedDate: row.last_booked_date ?? null,
    createdAt: row.created_at,
  };
}

export async function profileTimezone(db: Db, userId: string): Promise<string> {
  const row = await db.prepare('SELECT timezone FROM profiles WHERE user_id = ?').get<{ timezone: string }>(userId);
  return row?.timezone ?? 'Europe/Stockholm';
}

/** Today in the user's timezone — the anchor for every booking decision. */
export async function todayForUser(db: Db, userId: string): Promise<string> {
  return localToday(await profileTimezone(db, userId));
}

/* --------------------------------- runner --------------------------------- */

export interface RunResult {
  booked: number;
  advanced: number;
  rules: number;
}

/**
 * Books every occurrence that has come due for one user. Called whenever the user opens the app,
 * so no background worker (and no cron) is needed for the numbers to stay correct.
 */
export async function runDueRules(db: Db, userId: string, today: string): Promise<RunResult> {
  const due = await db
    .prepare(`${SELECT} WHERE r.owner_id = ? AND r.active = 1 AND r.next_occurrence <= ? ORDER BY r.next_occurrence, r.seq`)
    .all<RecurringRuleRow>(userId, today);

  let booked = 0;
  for (const row of due) {
    await db.tx(async (tx) => {
      // Re-read inside the transaction: another request may have advanced the rule already.
      const current = await tx
        .prepare('SELECT * FROM recurring_rules WHERE id = ? AND owner_id = ? AND active = 1')
        .get<RecurringRuleRow>(row.id, userId);
      if (!current) return;

      const schedule = scheduleOf(current);
      let cursor: string | null = current.next_occurrence;
      let produced = 0;

      while (cursor && cursor <= today && produced < MAX_BOOKINGS_PER_RUN) {
        if (current.end_month && monthOf(cursor) > current.end_month) {
          cursor = null;
          break;
        }
        const inserted = await tx
          .prepare(
            `INSERT INTO recurring_bookings (id, rule_id, owner_id, occurrence_date, amount_ore, created_at)
             VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (rule_id, occurrence_date) DO NOTHING`,
          )
          .run(uuid(), current.id, userId, cursor, current.amount_ore, nowIso());
        if (inserted > 0) {
          const transaction = await createTransaction(tx, userId, {
            type: current.type,
            amountOre: current.amount_ore,
            category: current.category,
            description: current.description,
            // Booked at local noon so the dated row sorts sensibly in every timezone.
            occurredAt: `${cursor}T12:00:00.000Z`,
          });
          await tx
            .prepare('UPDATE recurring_bookings SET transaction_id = ? WHERE rule_id = ? AND occurrence_date = ?')
            .run(transaction.id, current.id, cursor);
          booked += 1;
          produced += 1;
        }
        cursor = nextOccurrence(schedule, cursor, current.end_month);
      }

      const finished = cursor === null;
      await tx
        .prepare('UPDATE recurring_rules SET next_occurrence = ?, active = ?, updated_at = ? WHERE id = ?')
        .run(
          finished ? current.next_occurrence : (cursor as string),
          finished ? 0 : 1,
          nowIso(),
          current.id,
        );
    });
  }

  return { booked, advanced: due.length, rules: due.length };
}

/* ----------------------------------- CRUD --------------------------------- */

export interface RuleInput {
  type: 'income' | 'expense';
  amountOre: number;
  category: string;
  description?: string | null;
  interval: RecurrenceInterval;
  startDate?: string | undefined;
  dayOfMonth?: number | undefined;
  weekday?: number | undefined;
  endMonth?: string | null | undefined;
  active?: boolean | undefined;
}

function validateSchedule(input: RuleInput, today: string): { schedule: Schedule; startDate: string } {
  const startDate = input.startDate ?? today;
  if (!isDateString(startDate)) throw badRequest('Ogiltigt startdatum.');
  if (startDate < '2000-01-01' || startDate > '2100-12-31') throw badRequest('Startdatumet ligger utanför intervallet.');
  if (input.endMonth && !isMonthString(input.endMonth)) throw badRequest('Ange slutmånad som ÅÅÅÅ-MM.');
  if (input.endMonth && input.endMonth < monthOf(startDate)) {
    throw badRequest('Slutmånaden kan inte ligga före startdatumet.');
  }

  if (input.interval === 'weekly') {
    const weekday = input.weekday ?? isoWeekday(startDate);
    if (weekday < 1 || weekday > 7) throw badRequest('Veckodagen måste vara mellan 1 (måndag) och 7 (söndag).');
    return { schedule: { interval: 'weekly', startDate, dayOfMonth: 0, weekday }, startDate };
  }

  const dayOfMonth = input.dayOfMonth ?? Number(startDate.slice(8, 10));
  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
    throw badRequest('Dagen i månaden måste vara mellan 1 och 31.');
  }
  return {
    schedule: { interval: input.interval, startDate, dayOfMonth, weekday: 0 },
    startDate,
  };
}

export async function createRule(db: Db, userId: string, input: RuleInput, today: string): Promise<RecurringRuleView> {
  const { schedule, startDate } = validateSchedule(input, today);
  // The first booking is always in the future: creating a rule never rewrites the current month.
  const firstOccurrence =
    startDate > today
      ? occurrenceAtOrAfter(schedule, startDate, true)
      : occurrenceAtOrAfter(schedule, today, false);
  const endMonth = input.endMonth ?? null;
  if (endMonth && monthOf(firstOccurrence) > endMonth) {
    throw badRequest('Slutmånaden ligger före första bokningen.');
  }

  const id = uuid();
  const now = nowIso();
  await db.prepare(
    `INSERT INTO recurring_rules
       (id, owner_id, type, amount_ore, category, description, interval, start_date, day_of_month, weekday,
        end_month, next_occurrence, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    userId,
    input.type,
    input.amountOre,
    input.category,
    input.description ?? null,
    input.interval,
    startDate,
    schedule.interval === 'weekly' ? null : schedule.dayOfMonth,
    schedule.interval === 'weekly' ? schedule.weekday : null,
    endMonth,
    firstOccurrence,
    input.active === false ? 0 : 1,
    now,
    now,
  );
  return await getRule(db, userId, id, today);
}

export async function getRule(db: Db, userId: string, id: string, today: string): Promise<RecurringRuleView> {
  const row = await db.prepare(`${SELECT} WHERE r.id = ? AND r.owner_id = ?`).get<RecurringRuleRow>(id, userId);
  if (!row) throw notFound('Den återkommande posten hittades inte.');
  return toView(row, today);
}

export async function listRules(
  db: Db,
  userId: string,
  today: string,
): Promise<{ rules: RecurringRuleView[]; summary: RecurringSummary }> {
  const rows = await db
    .prepare(`${SELECT} WHERE r.owner_id = ? ORDER BY r.active DESC, r.next_occurrence, r.seq`)
    .all<RecurringRuleRow>(userId);
  const rules = rows.map((row) => toView(row, today));

  let monthlyIncomeOre = 0;
  let monthlyExpenseOre = 0;
  let activeCount = 0;
  let pausedCount = 0;
  for (const rule of rules) {
    if (!rule.active) {
      pausedCount += 1;
      continue;
    }
    activeCount += 1;
    if (rule.type === 'income') monthlyIncomeOre += rule.monthlyOre;
    else monthlyExpenseOre += rule.monthlyOre;
  }

  const booked = await db
    .prepare(
      `SELECT COALESCE(SUM(amount_ore), 0) AS total, COUNT(*) AS count FROM recurring_bookings
       WHERE owner_id = ? AND occurrence_date >= ? AND occurrence_date <= ?`,
    )
    .get<{ total: number; count: number }>(userId, `${today.slice(0, 7)}-01`, `${today.slice(0, 7)}-31`);

  return {
    rules,
    summary: {
      monthlyIncomeOre,
      monthlyExpenseOre,
      monthlyNetOre: monthlyIncomeOre - monthlyExpenseOre,
      yearlyExpenseOre: monthlyExpenseOre * 12,
      activeCount,
      pausedCount,
      bookedThisMonthOre: Number(booked?.total ?? 0),
      bookedThisMonthCount: Number(booked?.count ?? 0),
    },
  };
}

export async function updateRule(
  db: Db,
  userId: string,
  id: string,
  input: Partial<RuleInput>,
  today: string,
): Promise<RecurringRuleView> {
  const existing = await db
    .prepare('SELECT * FROM recurring_rules WHERE id = ? AND owner_id = ?')
    .get<RecurringRuleRow>(id, userId);
  if (!existing) throw notFound('Den återkommande posten hittades inte.');

  const merged: RuleInput = {
    type: input.type ?? existing.type,
    amountOre: input.amountOre ?? existing.amount_ore,
    category: input.category ?? existing.category,
    description: input.description === undefined ? existing.description : input.description,
    interval: input.interval ?? existing.interval,
    startDate: input.startDate ?? existing.start_date,
    dayOfMonth: input.dayOfMonth ?? existing.day_of_month ?? undefined,
    weekday: input.weekday ?? existing.weekday ?? undefined,
    endMonth: input.endMonth === undefined ? existing.end_month : input.endMonth,
    active: input.active ?? existing.active === 1,
  };
  const { schedule, startDate } = validateSchedule(merged, today);

  // The schedule only changes when it was actually edited; otherwise keep the pending occurrence so
  // renaming an expense does not move its date.
  const scheduleChanged =
    (input.interval !== undefined && input.interval !== existing.interval) ||
    (input.startDate !== undefined && input.startDate !== existing.start_date) ||
    (input.dayOfMonth !== undefined && input.dayOfMonth !== existing.day_of_month) ||
    (input.weekday !== undefined && input.weekday !== existing.weekday) ||
    (input.endMonth !== undefined && (input.endMonth ?? null) !== existing.end_month);
  const resumed = input.active === true && existing.active === 0;

  let next = existing.next_occurrence;
  if (scheduleChanged || resumed) {
    next = occurrenceAtOrAfter(schedule, startDate > today ? startDate : today, startDate > today || !resumed);
    // Never schedule in the past: a resumed rule picks up at its next future date.
    if (next <= today && !scheduleChanged) next = occurrenceAtOrAfter(schedule, today, false);
  }
  const active = merged.active === false ? 0 : 1;

  await db.prepare(
    `UPDATE recurring_rules SET type = ?, amount_ore = ?, category = ?, description = ?, interval = ?,
       start_date = ?, day_of_month = ?, weekday = ?, end_month = ?, next_occurrence = ?, active = ?, updated_at = ?
     WHERE id = ? AND owner_id = ?`,
  ).run(
    merged.type,
    merged.amountOre,
    merged.category,
    merged.description ?? null,
    merged.interval,
    startDate,
    schedule.interval === 'weekly' ? null : schedule.dayOfMonth,
    schedule.interval === 'weekly' ? schedule.weekday : null,
    merged.endMonth ?? null,
    next,
    active,
    nowIso(),
    id,
    userId,
  );
  return await getRule(db, userId, id, today);
}

/** Deleting a rule keeps the transactions it already produced — they are real history. */
export async function deleteRule(db: Db, userId: string, id: string): Promise<void> {
  const removed = await db.prepare('DELETE FROM recurring_rules WHERE id = ? AND owner_id = ?').run(id, userId);
  if (removed === 0) throw notFound('Den återkommande posten hittades inte.');
}
