import type { Difficulty } from "./types";

export const DIFF_LABEL: Record<Difficulty, string> = { easy: "Lätt", medium: "Medel", hard: "Svår", expert: "Expert" };
export const DIFF_ORDER: Difficulty[] = ["easy", "medium", "hard", "expert"];
export const DEFAULT_XP: Record<Difficulty, number> = { easy: 10, medium: 25, hard: 50, expert: 100 };
export const DEFAULT_REPEAT = [1, 0.5, 0.25, 0];
export const COINS_PER_XP = 0.2;

export const QTYPE_LABEL: Record<string, string> = {
  mcq: "Flerval",
  tf: "Sant/falskt",
  fill: "Fyll i",
  numeric: "Numeriskt",
  short: "Kort svar",
  match: "Para ihop",
};

export const MODE_LABEL: Record<string, string> = {
  quick: "Quick Play",
  blackjack: "Knowledge Blackjack",
  wheel: "Knowledge Wheel",
  slots: "Knowledge Slots",
  highstakes: "High Stakes Quiz",
  brainrush: "Brain Rush",
  daily: "Dagens utmaning",
  lesson: "Lektionstest",
  duel: "Duell",
};

export function levelForXp(xp: number) {
  return Math.floor(Math.sqrt(Math.max(xp, 0) / 50)) + 1;
}
export function xpForLevel(level: number) {
  return (level - 1) * (level - 1) * 50;
}
export function rankForLevel(level: number) {
  if (level >= 30) return "Grandmaster";
  if (level >= 20) return "Master";
  if (level >= 15) return "Expert";
  if (level >= 10) return "Scholar";
  if (level >= 5) return "Apprentice";
  return "Rookie";
}
export const RANKS = [
  { name: "Rookie", from: 1 },
  { name: "Apprentice", from: 5 },
  { name: "Scholar", from: 10 },
  { name: "Expert", from: 15 },
  { name: "Master", from: 20 },
  { name: "Grandmaster", from: 30 },
];

export function levelProgress(xp: number) {
  const level = levelForXp(xp);
  const cur = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return { level, rank: rankForLevel(level), cur, next, pct: Math.min(100, Math.round(((xp - cur) / (next - cur)) * 100)), toNext: next - xp };
}

export function weekRange(d = new Date()) {
  // ISO week, Monday 00:00 Stockholm (approximated with UTC+1/+2 via local offsets of the server is unreliable; use fixed +1h)
  const tzOffsetMs = 60 * 60 * 1000;
  const local = new Date(d.getTime() + tzOffsetMs);
  const day = (local.getUTCDay() + 6) % 7; // Monday = 0
  const start = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - day) - tzOffsetMs);
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  return { from: start.toISOString(), to: end.toISOString() };
}

export function todayKey(d = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
