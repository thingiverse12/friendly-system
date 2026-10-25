import { z } from 'zod';
import type { Db } from '../db.js';
import { badRequest, unprocessable } from '../lib/errors.js';
import { nowMs } from './time.js';

/** Categori catalog is fixed so aggregates and UI stay predictable. */
export const INCOME_CATEGORIES = ['Lön', 'Bidrag', 'Återbäring', 'Övrig inkomst'] as const;
export const EXPENSE_CATEGORIES = [
  'Mat',
  'Boende',
  'Transport',
  'Nöje',
  'Hälsa',
  'Shopping',
  'Prenumerationer',
  'Övrig utgift',
] as const;
export const ALL_CATEGORIES = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES] as const;

export const emailSchema = z
  .string()
  .trim()
  .min(3)
  .max(254)
  .transform((value) => value.toLowerCase())
  .refine((value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value), 'Ange en giltig e-postadress.');

export const passwordSchema = z
  .string()
  .min(10, 'Lösenordet måste vara minst 10 tecken.')
  .max(200, 'Lösenordet är för långt.')
  .refine((v) => /[a-zA-ZåäöÅÄÖ]/.test(v) && /\d/.test(v), 'Lösenordet måste innehålla bokstäver och siffror.');

export const aliasSchema = z
  .string()
  .trim()
  .min(3, 'Alias måste vara minst 3 tecken.')
  .max(24, 'Alias får vara högst 24 tecken.')
  .refine((v) => /^[\p{L}\p{N}_.\- ]+$/u.test(v), 'Alias får bara innehålla bokstäver, siffror, punkt, bindestreck och understreck.')
  .refine((v) => v.trim().length === v.length, 'Alias får inte börja eller sluta med mellanslag.');

export const timezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat('sv-SE', { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, 'Ogiltig tidszon.');

export const goalNameSchema = z
  .string()
  .trim()
  .min(1, 'Namn krävs.')
  .max(80, 'Namnet får vara högst 80 tecken.');

/** Exact integer öre only: rejects floats, negatives, zero, strings and absurd values. */
export const amountOreSchema = z
  .number({ error: 'Ange ett belopp.' })
  .int('Belopp måste anges i hela öre.')
  .positive('Beloppet måste vara större än 0.')
  .max(1_000_000_000_00, 'Beloppet är för stort.');

export const isoDateSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Ogiltigt datum.')
  .transform((value) => new Date(value).toISOString());

export function parseBody<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data ?? {});
  if (!result.success) {
    const issues = result.error.issues.map((issue) => ({
      field: issue.path.join('.') || '_',
      message: issue.message,
    }));
    throw unprocessable(issues[0]?.message ?? 'Ogiltig förfrågan.', { issues });
  }
  return result.data;
}

export function parseQuery<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data ?? {});
  if (!result.success) {
    throw badRequest(result.error.issues[0]?.message ?? 'Ogiltiga parametrar.');
  }
  return result.data;
}

export interface RateLimitRule {
  limit: number;
  windowMs: number;
}

export const RATE_LIMITS = {
  login: { limit: 8, windowMs: 15 * 60 * 1000 },
  register: { limit: 5, windowMs: 60 * 60 * 1000 },
  passwordRequest: { limit: 5, windowMs: 60 * 60 * 1000 },
  passwordReset: { limit: 10, windowMs: 60 * 60 * 1000 },
  invitationJoin: { limit: 15, windowMs: 15 * 60 * 1000 },
  competitionJoin: { limit: 20, windowMs: 60 * 60 * 1000 },
  groupCreate: { limit: 10, windowMs: 60 * 60 * 1000 },
  invitationCreate: { limit: 30, windowMs: 60 * 60 * 1000 },
} satisfies Record<string, RateLimitRule>;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Fixed-window counter in SQLite. Counters are shared across the process (not per-worker memory),
 * so limits stay correct when the app is run behind multiple Node processes on the same DB file.
 */
export async function consumeRateLimit(db: Db, key: string, rule: RateLimitRule): Promise<RateLimitResult> {
  const windowMs = rule.windowMs;
  const windowStart = Math.floor(nowMs() / windowMs) * windowMs;
  const row = await db
    .prepare(
      `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
       ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1
       RETURNING rate_limits.count AS count`,
    )
    .get<{ count: number }>(key, windowStart);
  const count = row?.count ?? 0;
  if (count > rule.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((windowStart + windowMs - nowMs()) / 1000)),
    };
  }
  return { allowed: true, remaining: rule.limit - count, retryAfterSeconds: 0 };
}


