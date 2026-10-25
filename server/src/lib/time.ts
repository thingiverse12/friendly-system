import { config } from '../config.js';

let overridden: number | null = null;

/** Current server time in epoch milliseconds. All competition lifecycle decisions use this. */
export function nowMs(): number {
  return overridden ?? Date.now();
}

export function nowIso(): string {
  return new Date(nowMs()).toISOString();
}

export function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Test helper: freeze/advance server time. Disabled unless the process explicitly allows it,
 * so it can never be reached from an HTTP request.
 */
export function setTestClock(ms: number | null): void {
  if (ms !== null && !config.allowClockOverride) {
    throw new Error('Clock override is not permitted in this environment');
  }
  overridden = ms;
}

export function advanceTestClock(ms: number): void {
  if (!config.allowClockOverride) throw new Error('Clock override is not permitted in this environment');
  overridden = nowMs() + ms;
}
