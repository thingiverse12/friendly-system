import type { QType } from "./types";

/** Normalize free-text answers: lowercase, trim, collapse spaces, unify decimal comma. */
export function normalize(s: unknown) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[“”"']/g, "")
    .trim()
    .replace(/[.!?]+$/g, "")
    .trim();
}

function toNumber(s: unknown): number | null {
  if (typeof s === "number") return s;
  const t = String(s ?? "").replace(/\s/g, "").replace(",", ".").replace(/[^0-9.\-/]/g, "");
  if (!t) return null;
  if (t.includes("/")) {
    const [a, b] = t.split("/").map(Number);
    if (!b) return null;
    return a / b;
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Server-side grading. `answer` is the stored canonical answer (never sent to clients),
 * `response` is what the client submitted in *served* option order; `optionOrder` maps
 * served index -> original index for mcq/match right-column.
 */
export function grade(qtype: QType, answer: unknown, response: unknown, optionOrder: number[] | null): boolean {
  switch (qtype) {
    case "mcq": {
      if (typeof response !== "number") return false;
      const original = optionOrder ? optionOrder[response] : response;
      return original === Number(answer);
    }
    case "tf":
      return typeof response === "boolean" && response === Boolean(answer);
    case "fill":
    case "short": {
      const accepted = (Array.isArray(answer) ? answer : [answer]).map(normalize);
      const r = normalize(response);
      if (!r) return false;
      if (qtype === "fill") {
        if (accepted.includes(r)) return true;
        const rn = toNumber(r);
        return accepted.some((a) => toNumber(a) !== null && rn !== null && Math.abs(toNumber(a)! - rn) < 1e-9);
      }
      // short answer: at least one accepted keyword contained, and answer must have some substance
      return r.length >= 3 && accepted.some((k) => k && r.includes(k));
    }
    case "numeric": {
      const a = answer as { value: number; tol?: number };
      const r = toNumber(response);
      if (r === null) return false;
      return Math.abs(r - a.value) <= (a.tol ?? 0) + 1e-9;
    }
    case "match": {
      // answer: for each left i, index into ORIGINAL right array. response: served right index per left.
      if (!Array.isArray(response) || !Array.isArray(answer)) return false;
      if (response.length !== answer.length) return false;
      return response.every((srv, i) => {
        if (typeof srv !== "number") return false;
        const original = optionOrder ? optionOrder[srv] : srv;
        return original === answer[i];
      });
    }
  }
  return false;
}

/** Human-readable correct answer for feedback (uses served order so it matches what the student saw). */
export function displayAnswer(qtype: QType, answer: unknown, options: unknown, optionOrder: number[] | null): string {
  switch (qtype) {
    case "mcq": {
      const opts = options as string[];
      return opts?.[Number(answer)] ?? String(answer);
    }
    case "tf":
      return answer ? "Sant" : "Falskt";
    case "fill":
    case "short":
      return (Array.isArray(answer) ? answer : [answer]).slice(0, 2).join(" / ");
    case "numeric": {
      const a = answer as { value: number; tol?: number };
      return a.tol ? `${a.value} (±${a.tol})` : String(a.value);
    }
    case "match": {
      const o = options as { left: string[]; right: string[] };
      return (answer as number[]).map((ri, i) => `${o.left[i]} → ${o.right[ri]}`).join(", ");
    }
  }
  void optionOrder;
  return String(answer);
}

export function displayResponse(qtype: QType, response: unknown, options: unknown, optionOrder: number[] | null): string {
  if (response === null || response === undefined) return "—";
  switch (qtype) {
    case "mcq": {
      const opts = options as string[];
      const original = optionOrder ? optionOrder[Number(response)] : Number(response);
      return opts?.[original] ?? "—";
    }
    case "tf":
      return response ? "Sant" : "Falskt";
    case "match": {
      const o = options as { left: string[]; right: string[] };
      return (response as number[])
        .map((srv, i) => `${o.left[i]} → ${o.right[optionOrder ? optionOrder[srv] : srv] ?? "?"}`)
        .join(", ");
    }
    default:
      return String(response);
  }
}

export function shuffle<T>(arr: T[], rnd: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Deterministic PRNG (mulberry32) so daily challenges are identical for everyone. */
export function seeded(seedStr: string) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
