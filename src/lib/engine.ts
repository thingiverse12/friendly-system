import { admin } from "./supabase/admin";
import { HttpError, logSecurity } from "./auth";
import { displayAnswer, displayResponse, grade, seeded, shuffle } from "./grading";
import { COINS_PER_XP, DEFAULT_REPEAT, DEFAULT_XP, DIFF_ORDER, levelForXp } from "./xp";
import type { AnswerResult, Difficulty, GameMode, PublicQuestion, QType, ResultItem, SessionView } from "./types";

export interface QuestionRow {
  id: string | null;
  subject_id: string;
  chapter_id: string | null;
  difficulty: Difficulty;
  qtype: QType;
  prompt: string;
  options: unknown;
  answer: unknown;
  explanation: string | null;
  source: "verified" | "ai" | "generated";
}

interface SessionRow {
  id: string;
  user_id: string;
  mode: GameMode;
  subject_id: string | null;
  difficulty: Difficulty | null;
  status: "active" | "finished" | "abandoned" | "bust";
  competitive: boolean;
  score: number;
  correct: number;
  total: number;
  xp_awarded: number;
  coins_awarded: number;
  meta: Record<string, unknown>;
  created_at: string;
  finished_at: string | null;
}

interface ItemRow {
  id: string;
  session_id: string;
  idx: number;
  question_id: string | null;
  generated: QuestionRow | null;
  option_order: number[] | null;
  served_at: string | null;
  answered_at: string | null;
  correct: boolean | null;
  xp: number;
  response: unknown;
  questions?: QuestionRow | null;
}

const CHOICE: QType[] = ["mcq", "tf"];
const WRITTEN: QType[] = ["fill", "numeric", "short", "match"];
const FAST_MS = 1200;
const BRAINRUSH_SECONDS = 60;

// ---------- config ----------
let cfgCache: { at: number; xp: Record<Difficulty, number>; repeat: number[]; coinsPerXp: number } | null = null;
export async function getConfig() {
  if (cfgCache && Date.now() - cfgCache.at < 60_000) return cfgCache;
  const { data } = await admin().from("app_config").select("key,value");
  const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
  cfgCache = {
    at: Date.now(),
    xp: { ...DEFAULT_XP, ...((map.xp_by_difficulty as Record<Difficulty, number>) ?? {}) },
    repeat: (map.repeat_multipliers as number[]) ?? DEFAULT_REPEAT,
    coinsPerXp: Number(map.coins_per_xp ?? COINS_PER_XP),
  };
  return cfgCache;
}

// ---------- adaptive recommendation ----------
export interface Recommendation {
  subjectId: string;
  subjectName: string;
  difficulty: Difficulty;
  formats: QType[] | null;
  reason: string;
  formatReason: string | null;
  perSubject: Record<string, { difficulty: Difficulty; accuracy: number | null; total: number }>;
}

export async function recommend(userId: string): Promise<Recommendation> {
  const db = admin();
  const [{ data: subjects }, { data: ks }, { data: fs }] = await Promise.all([
    db.from("subjects").select("id,name,sort").eq("active", true).order("sort"),
    db.from("knowledge_state").select("subject_id,difficulty,correct,total").eq("user_id", userId),
    db.from("format_state").select("qtype,correct,total").eq("user_id", userId),
  ]);
  const perSubject: Recommendation["perSubject"] = {};
  for (const s of subjects ?? []) {
    const rows = (ks ?? []).filter((k) => k.subject_id === s.id);
    let rec: Difficulty = "easy";
    for (const d of DIFF_ORDER) {
      const r = rows.find((x) => x.difficulty === d);
      if (r && r.total >= 4 && r.correct / r.total >= 0.7 && d !== "expert") rec = DIFF_ORDER[DIFF_ORDER.indexOf(d) + 1];
      else break;
    }
    const total = rows.reduce((a, r) => a + r.total, 0);
    const correct = rows.reduce((a, r) => a + r.correct, 0);
    perSubject[s.id] = { difficulty: rec, accuracy: total ? correct / total : null, total };
  }
  // subject: weakest practiced subject (<70%, ≥4 attempts) else least practiced
  let pick = (subjects ?? [])[0];
  let reason = "Ett nytt område att utforska";
  const weak = (subjects ?? [])
    .filter((s) => perSubject[s.id].total >= 4 && (perSubject[s.id].accuracy ?? 1) < 0.7)
    .sort((a, b) => (perSubject[a.id].accuracy ?? 0) - (perSubject[b.id].accuracy ?? 0));
  if (weak.length) {
    pick = weak[0];
    reason = `Du har ${Math.round((perSubject[pick.id].accuracy ?? 0) * 100)} % rätt här – en kort runda ger stor effekt`;
  } else {
    const least = [...(subjects ?? [])].sort((a, b) => perSubject[a.id].total - perSubject[b.id].total)[0];
    if (least) {
      pick = least;
      reason = perSubject[least.id].total === 0 ? "Du har inte provat det här ämnet än" : "Minst övat på senaste tiden";
    }
  }
  // format: separate knowledge from answer format
  const sum = (types: QType[]) => {
    const rows = (fs ?? []).filter((f) => types.includes(f.qtype as QType));
    const t = rows.reduce((a, r) => a + r.total, 0);
    const c = rows.reduce((a, r) => a + r.correct, 0);
    return { t, acc: t ? c / t : null };
  };
  const ch = sum(CHOICE);
  const wr = sum(WRITTEN);
  let formats: QType[] | null = null;
  let formatReason: string | null = null;
  if (wr.t >= 5 && ch.t >= 5 && wr.acc !== null && ch.acc !== null && ch.acc - wr.acc >= 0.15) {
    formats = CHOICE;
    formatReason = `Du kan mer än vad skrivna svar visar (${Math.round(wr.acc * 100)} % mot ${Math.round(
      ch.acc * 100
    )} % med alternativ). Vi visar fler flervalsfrågor – byt själv när du vill.`;
  } else if (ch.t >= 10 && ch.acc !== null && ch.acc >= 0.85 && (wr.acc === null || wr.t < 5)) {
    formats = null;
    formatReason = "Du är stabil på flerval – nu blandar vi in frågor där du skriver svaret själv.";
  }
  return {
    subjectId: pick?.id ?? "matematik",
    subjectName: pick?.name ?? "Matematik",
    difficulty: perSubject[pick?.id ?? ""]?.difficulty ?? "easy",
    formats,
    reason,
    formatReason,
    perSubject,
  };
}

export function formatsFromPreference(pref: string | undefined, recommended: QType[] | null): QType[] | null {
  switch (pref) {
    case "choice":
      return CHOICE;
    case "written":
      return WRITTEN;
    case "mixed":
      return null;
    default:
      return recommended;
  }
}

// ---------- question selection ----------
export async function pickQuestions(
  userId: string,
  opts: { subjectId: string; difficulties: Difficulty[]; count: number; formats?: QType[] | null; exclude?: string[]; rnd?: () => number; verifiedOnly?: boolean }
): Promise<QuestionRow[]> {
  const db = admin();
  let q = db
    .from("questions")
    .select("id,subject_id,chapter_id,difficulty,qtype,prompt,options,answer,explanation,source,owner_id")
    .eq("subject_id", opts.subjectId)
    .eq("active", true)
    .in("difficulty", opts.difficulties);
  q = opts.verifiedOnly ? q.is("owner_id", null) : q.or(`owner_id.is.null,owner_id.eq.${userId}`);
  const { data } = await q;
  let pool = (data ?? []) as (QuestionRow & { owner_id: string | null })[];
  if (opts.exclude?.length) pool = pool.filter((x) => !opts.exclude!.includes(x.id!));
  const rnd = opts.rnd ?? Math.random;
  const ids = pool.map((p) => p.id!);
  const { data: attempts } = ids.length
    ? await db.from("question_attempts").select("question_id,attempts,correct_count").eq("user_id", userId).in("question_id", ids)
    : { data: [] };
  const att = new Map((attempts ?? []).map((a) => [a.question_id, a]));
  const score = (x: QuestionRow) => {
    const a = att.get(x.id!);
    return (a?.correct_count ?? 0) * 10 + (a?.attempts ?? 0) + rnd() * 3;
  };
  const ranked = shuffle(pool, rnd).sort((a, b) => score(a) - score(b));
  const preferred = opts.formats ? ranked.filter((x) => opts.formats!.includes(x.qtype)) : ranked;
  const chosen = preferred.slice(0, opts.count);
  if (chosen.length < opts.count) {
    for (const x of ranked) {
      if (chosen.length >= opts.count) break;
      if (!chosen.includes(x)) chosen.push(x);
    }
  }
  return chosen.map(({ owner_id: _o, ...rest }) => rest);
}

/** Brain Rush: server-generated arithmetic, answers kept in session_items.generated. */
export function generateArithmetic(n: number, level: number): QuestionRow[] {
  const out: QuestionRow[] = [];
  const r = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
  for (let i = 0; i < n; i++) {
    const hard = level >= 10 || i >= n * 0.6;
    const t = r(0, hard ? 4 : 2);
    let prompt = "";
    let value = 0;
    if (t === 0) {
      const a = r(hard ? 25 : 5, hard ? 199 : 60), b = r(hard ? 25 : 5, hard ? 199 : 60);
      prompt = `${a} + ${b}`; value = a + b;
    } else if (t === 1) {
      const a = r(hard ? 60 : 10, hard ? 250 : 90), b = r(2, a - 1);
      prompt = `${a} − ${b}`; value = a - b;
    } else if (t === 2) {
      const a = r(2, hard ? 15 : 10), b = r(2, hard ? 15 : 10);
      prompt = `${a} × ${b}`; value = a * b;
    } else if (t === 3) {
      const b = r(2, 12), v = r(2, 12);
      prompt = `${b * v} ÷ ${b}`; value = v;
    } else {
      const p = [10, 20, 25, 50][r(0, 3)], base = r(1, 20) * 20;
      prompt = `${p} % av ${base}`; value = (p / 100) * base;
    }
    out.push({ id: null, subject_id: "matematik", chapter_id: null, difficulty: "easy", qtype: "numeric", prompt, options: null, answer: { value, tol: 0 }, explanation: `${prompt} = ${value}`, source: "generated" });
  }
  return out;
}

// ---------- session lifecycle ----------
export async function createSession(
  userId: string,
  opts: { mode: GameMode; subjectId: string | null; difficulty: Difficulty | null; questions: QuestionRow[]; competitive?: boolean; meta?: Record<string, unknown>; rnd?: () => number }
) {
  if (!opts.questions.length) throw new HttpError(400, "Inga frågor hittades för det valet ännu.");
  const db = admin();
  const { data: s, error } = await db
    .from("game_sessions")
    .insert({ user_id: userId, mode: opts.mode, subject_id: opts.subjectId, difficulty: opts.difficulty, competitive: !!opts.competitive, total: opts.questions.length, meta: opts.meta ?? {} })
    .select("id")
    .single();
  if (error || !s) throw new HttpError(500, "Kunde inte skapa runda");
  const rnd = opts.rnd ?? Math.random;
  const items = opts.questions.map((q, idx) => {
    let option_order: number[] | null = null;
    if (q.qtype === "mcq" && Array.isArray(q.options)) option_order = shuffle(q.options.map((_, i) => i), rnd);
    if (q.qtype === "match" && q.options && typeof q.options === "object") {
      const right = (q.options as { right: string[] }).right ?? [];
      option_order = shuffle(right.map((_, i) => i), rnd);
    }
    return { session_id: s.id, idx, question_id: q.id, generated: q.id ? null : q, option_order };
  });
  const { error: e2 } = await db.from("session_items").insert(items);
  if (e2) throw new HttpError(500, "Kunde inte skapa frågor");
  return s.id as string;
}

export async function loadSession(sessionId: string, userId: string) {
  const db = admin();
  const [{ data: session }, { data: items }] = await Promise.all([
    db.from("game_sessions").select("*").eq("id", sessionId).eq("user_id", userId).maybeSingle(),
    db.from("session_items").select("*, questions(id,subject_id,chapter_id,difficulty,qtype,prompt,options,answer,explanation,source)").eq("session_id", sessionId).order("idx"),
  ]);
  if (!session) throw new HttpError(404, "Rundan finns inte");
  return { session: session as SessionRow, items: (items ?? []) as ItemRow[] };
}

function questionOf(item: ItemRow): QuestionRow {
  return (item.questions ?? item.generated) as QuestionRow;
}

function servedOptions(q: QuestionRow, order: number[] | null): PublicQuestion["options"] {
  if (q.qtype === "mcq" && Array.isArray(q.options)) return order ? order.map((i) => (q.options as string[])[i]) : (q.options as string[]);
  if (q.qtype === "match" && q.options && typeof q.options === "object") {
    const o = q.options as { left: string[]; right: string[] };
    return { left: o.left, right: order ? order.map((i) => o.right[i]) : o.right };
  }
  return null;
}

export function toPublic(item: ItemRow): PublicQuestion {
  const q = questionOf(item);
  return { idx: item.idx, qtype: q.qtype, prompt: q.prompt, options: servedOptions(q, item.option_order), difficulty: q.difficulty, subject_id: q.subject_id, source: q.source };
}

function handTotal(hand: number[]) {
  let total = hand.reduce((a, b) => a + b, 0);
  let aces = hand.filter((c) => c === 11).length;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

function publicMeta(s: SessionRow) {
  const m = s.meta ?? {};
  const out: Record<string, unknown> = {};
  for (const k of ["hand", "wheel", "reels", "deadline", "stakes", "bonus", "bonus_reason", "subject_name", "label", "flags", "duel_id", "combo", "max_combo", "record"]) if (k in m) out[k] = m[k];
  if (Array.isArray(m.hand)) out.hand_total = handTotal(m.hand as number[]);
  return out;
}

export function sessionView(s: SessionRow, items: ItemRow[], withResults = false): SessionView {
  const answered = items.filter((i) => i.answered_at).length;
  const current = s.status === "active" ? items.find((i) => !i.answered_at) ?? null : null;
  const view: SessionView = {
    id: s.id, mode: s.mode, status: s.status, subject_id: s.subject_id, difficulty: s.difficulty, competitive: s.competitive,
    score: s.score, correct: s.correct, total: s.total, answered, xp_awarded: s.xp_awarded, coins_awarded: s.coins_awarded,
    current: current ? toPublic(current) : null, public_meta: publicMeta(s), created_at: s.created_at, finished_at: s.finished_at,
  };
  if (withResults && s.status !== "active") {
    view.results = items
      .filter((i) => i.answered_at)
      .map((i): ResultItem => {
        const q = questionOf(i);
        const opts = servedOptions(q, i.option_order);
        return {
          idx: i.idx, prompt: q.prompt, correct: i.correct, xp: i.xp, explanation: q.explanation,
          correct_answer: displayAnswer(q.qtype, q.answer, q.qtype === "mcq" ? q.options : q.qtype === "match" ? q.options : opts, i.option_order),
          your_answer: displayResponse(q.qtype, i.response, q.options, i.option_order),
        };
      });
  }
  return view;
}

/** Marks the current item as served (starts the response timer) and returns the view. */
export async function serve(sessionId: string, userId: string, withResults = false) {
  const { session, items } = await loadSession(sessionId, userId);
  if (session.status === "active") {
    const cur = items.find((i) => !i.answered_at);
    if (cur && !cur.served_at) {
      cur.served_at = new Date().toISOString();
      await admin().from("session_items").update({ served_at: cur.served_at }).eq("id", cur.id);
    }
    // Brain Rush timeout → auto finish
    if (session.mode === "brainrush" && session.meta.deadline && Date.now() > new Date(session.meta.deadline as string).getTime() + 3000) {
      await finishSession(session, items, userId);
      return serve(sessionId, userId, withResults);
    }
  }
  return sessionView(session, items, withResults);
}

async function awardXp(userId: string, amount: number, coins: number, reason: string, sessionId: string | null) {
  const { data } = await admin().rpc("award_xp", { p_user: userId, p_amount: amount, p_coins: coins, p_reason: reason, p_session: sessionId });
  const row = Array.isArray(data) ? data[0] : data;
  return row as { xp: number; coins: number; level: number };
}

// ---------- answering ----------
export async function answerItem(sessionId: string, userId: string, idx: number, response: unknown): Promise<AnswerResult> {
  const db = admin();
  const cfg = await getConfig();
  const { session, items } = await loadSession(sessionId, userId);
  if (session.status !== "active") throw new HttpError(409, "Rundan är redan avslutad");
  const current = items.find((i) => !i.answered_at);
  if (!current || current.idx !== idx) throw new HttpError(409, "Fel fråga – ladda om rundan");
  const q = questionOf(current);
  const now = new Date();
  const flags: string[] = [];

  // Brain Rush deadline
  if (session.mode === "brainrush" && session.meta.deadline && now.getTime() > new Date(session.meta.deadline as string).getTime() + 3000) {
    await finishSession(session, items, userId);
    const v = await serve(sessionId, userId, true);
    return { correct: false, xp: 0, coins: 0, explanation: null, correct_answer: null, finished: true, session: v, flags: ["time_over"] };
  }

  const correct = grade(q.qtype, q.answer, response, current.option_order);
  const servedAt = current.served_at ? new Date(current.served_at).getTime() : now.getTime();
  const ms = now.getTime() - servedAt;

  // XP: difficulty base × repeat multiplier; guessing/too-fast is not rewarded
  let xp = 0;
  const prevCorrect: number = (await db.rpc("record_attempt", {
    p_user: userId, p_question: q.id, p_subject: q.subject_id, p_difficulty: q.difficulty, p_qtype: q.qtype, p_correct: correct,
  })).data ?? 0;
  if (correct) {
    if (q.source === "generated") xp = 4;
    else {
      const mult = cfg.repeat[Math.min(prevCorrect, cfg.repeat.length - 1)] ?? 0;
      xp = Math.round(cfg.xp[q.difficulty] * mult);
      if (mult === 0) flags.push("repeat_no_xp");
      else if (mult < 1) flags.push("repeat_reduced");
    }
    if (q.source === "ai") xp = Math.round(xp * 0.5); // unverified content earns less
    if (ms < FAST_MS && q.qtype !== "tf" && session.mode !== "brainrush") {
      flags.push("fast_answer");
      xp = Math.floor(xp / 2);
      const fastCount = Number(session.meta.fast_count ?? 0) + 1;
      session.meta.fast_count = fastCount;
      await logSecurity(userId, "fast_answer", fastCount >= 5 ? "warning" : "info", { session: sessionId, ms, idx });
      if (fastCount === 8) await logSecurity(userId, "fast_pattern", "review", { session: sessionId, note: "Många mycket snabba rätta svar – granska manuellt. Inga automatiska åtgärder." });
    }
  }
  const coins = Math.ceil(xp * cfg.coinsPerXp);

  // Blackjack: draw a card on correct answers
  let blackjack: AnswerResult["blackjack"];
  if (session.mode === "blackjack") {
    const hand = [...((session.meta.hand as number[]) ?? [])];
    let card: number | null = null;
    if (correct) {
      card = [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10, 11][Math.floor(Math.random() * 13)];
      hand.push(card);
    }
    const total = handTotal(hand);
    session.meta.hand = hand;
    blackjack = { card, hand, total, bust: total > 21, blackjack: total === 21 };
  }

  // High stakes: score multiplier grows per round
  let scoreDelta = correct ? (q.difficulty === "easy" ? 1 : q.difficulty === "medium" ? 2 : q.difficulty === "hard" ? 3 : 4) : 0;
  if (session.mode === "highstakes" && correct) scoreDelta = (idx + 1) * 10;

  current.answered_at = now.toISOString();
  current.correct = correct;
  current.xp = xp;
  current.response = response;

  // Combo (consecutive correct answers in this round). Cosmetic + small coin bonus at milestones – never extra XP.
  const combo = correct ? Number(session.meta.combo ?? 0) + 1 : 0;
  session.meta.combo = combo;
  session.meta.max_combo = Math.max(Number(session.meta.max_combo ?? 0), combo);
  const comboCoins = combo === 5 ? 5 : combo === 10 ? 15 : 0;

  session.correct += correct ? 1 : 0;
  session.score += scoreDelta;
  session.xp_awarded += xp;
  session.coins_awarded += coins + comboCoins;

  const remaining = items.filter((i) => !i.answered_at).length;
  const willFinish = remaining === 0 || !!(blackjack && (blackjack.bust || blackjack.blackjack));
  const nextItem = willFinish ? null : items.find((i) => !i.answered_at) ?? null;
  if (nextItem && !nextItem.served_at) nextItem.served_at = now.toISOString();

  // One parallel batch instead of a chain of sequential roundtrips.
  const [prof] = await Promise.all([
    awardXp(userId, xp, coins + comboCoins, `${session.mode}:${correct ? "correct" : "wrong"}${comboCoins ? "+combo" : ""}`, sessionId),
    db.from("session_items").update({ answered_at: current.answered_at, correct, xp, response: response ?? null }).eq("id", current.id),
    nextItem ? db.from("session_items").update({ served_at: nextItem.served_at }).eq("id", nextItem.id) : Promise.resolve(null),
    willFinish ? Promise.resolve(null) : db.from("game_sessions").update({ correct: session.correct, score: session.score, xp_awarded: session.xp_awarded, coins_awarded: session.coins_awarded, meta: session.meta }).eq("id", sessionId),
  ]);
  const levelUp = prof && levelForXp(Math.max(0, prof.xp - xp)) < prof.level ? prof.level : null;

  let finished = false;
  if (willFinish) {
    await finishSession(session, items, userId, blackjack?.bust ? "bust" : "finished");
    finished = true;
  }
  // Achievements are only re-evaluated when something relevant happened (saves 3–6 queries per answer).
  const achievements = finished || levelUp || blackjack?.blackjack ? await checkAchievements(userId, { mode: session.mode, blackjack21: !!blackjack?.blackjack }) : [];
  const view = sessionView(session, items, finished);
  const showExplanation = !(session.competitive && !finished);
  const servedOpts = servedOptions(q, current.option_order);
  return {
    correct, xp, coins: coins + comboCoins, finished, session: view, flags, level_up: levelUp, achievements, blackjack,
    combo, combo_bonus: comboCoins,
    profile: prof ? { xp: prof.xp, coins: prof.coins, level: prof.level } : undefined,
    explanation: showExplanation ? q.explanation : null,
    correct_answer: showExplanation ? displayAnswer(q.qtype, q.answer, q.qtype === "mcq" || q.qtype === "match" ? q.options : servedOpts, current.option_order) : null,
  };
}

export async function finishSession(session: SessionRow, items: ItemRow[], userId: string, status: "finished" | "bust" | "abandoned" = "finished", extra?: { stand?: boolean }) {
  if (session.status !== "active") return session;
  const db = admin();
  let bonus = 0;
  let reason = "";
  const answered = items.filter((i) => i.answered_at).length;
  const ratio = answered ? session.correct / answered : 0;
  if (status === "finished") {
    if (session.mode === "daily" && answered >= session.total && ratio >= 0.7) { bonus = 100; reason = "Dagens utmaning klarad (≥70 %)"; }
    if (session.mode === "highstakes" && answered >= session.total && session.correct === session.total) { bonus = 100; reason = "Felfri High Stakes-runda"; }
    if (session.mode === "brainrush" && session.correct >= 15) { bonus = 50; reason = "15+ rätt i Brain Rush"; }
    if (session.mode === "blackjack") {
      const total = handTotal((session.meta.hand as number[]) ?? []);
      if (total === 21) { bonus = 75; reason = "Blackjack – exakt 21!"; }
      else if (extra?.stand && total > 0) { bonus = total * 3; reason = `Stannade på ${total}`; }
    }
    if (session.mode === "lesson" && answered >= session.total && ratio >= 0.8) { bonus = 20; reason = "Lektionstest klarat"; }
  }
  const coins = Math.ceil(bonus * (await getConfig()).coinsPerXp);
  let record = false;
  const [, best] = await Promise.all([
    bonus > 0 ? awardXp(userId, bonus, coins, `${session.mode}:bonus`, session.id) : Promise.resolve(null),
    status === "finished" && answered >= 3 && session.mode !== "lesson"
      ? db.from("game_sessions").select("correct").eq("user_id", userId).eq("mode", session.mode).neq("id", session.id).neq("status", "active").order("correct", { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (status === "finished" && answered >= 3 && session.mode !== "lesson") record = session.correct > Number(best?.data?.correct ?? -1) && session.correct >= 3;
  session.status = status;
  session.finished_at = new Date().toISOString();
  session.xp_awarded += bonus;
  session.coins_awarded += coins;
  session.meta = { ...session.meta, bonus, bonus_reason: reason, record };
  await db.from("game_sessions").update({ status, finished_at: session.finished_at, correct: session.correct, score: session.score, xp_awarded: session.xp_awarded, coins_awarded: session.coins_awarded, meta: session.meta }).eq("id", session.id);
  if (session.mode === "duel" && session.meta.duel_id) await settleDuel(session.meta.duel_id as string);
  return session;
}

export async function standBlackjack(sessionId: string, userId: string) {
  const { session, items } = await loadSession(sessionId, userId);
  if (session.mode !== "blackjack" || session.status !== "active") throw new HttpError(409, "Kan inte stanna nu");
  await finishSession(session, items, userId, "finished", { stand: true });
  await checkAchievements(userId, { mode: "blackjack", blackjack21: handTotal((session.meta.hand as number[]) ?? []) === 21 });
  return sessionView(session, items, true);
}

export async function abandonSession(sessionId: string, userId: string) {
  const { session, items } = await loadSession(sessionId, userId);
  if (session.status === "active") await finishSession(session, items, userId, items.some((i) => i.answered_at) ? "finished" : "abandoned");
  return sessionView(session, items, true);
}

// ---------- duels ----------
async function settleDuel(duelId: string) {
  const db = admin();
  const { data: d } = await db.from("duels").select("*").eq("id", duelId).maybeSingle();
  if (!d || d.status === "finished") return;
  const ids = [d.challenger_session, d.opponent_session].filter(Boolean) as string[];
  if (ids.length < 2) return;
  const { data: ss } = await db.from("game_sessions").select("id,user_id,correct,score,status,finished_at").in("id", ids);
  if (!ss || ss.length < 2 || ss.some((s) => s.status === "active")) return;
  const [a, b] = ss;
  let winner: string | null = null;
  if (a.correct !== b.correct) winner = a.correct > b.correct ? a.user_id : b.user_id;
  else if (a.finished_at && b.finished_at) winner = new Date(a.finished_at) < new Date(b.finished_at) ? a.user_id : b.user_id;
  await db.from("duels").update({ status: "finished", winner_id: winner, finished_at: new Date().toISOString() }).eq("id", duelId);
  if (winner) await awardXp(winner, 30, 6, "duel:win", null);
}

// ---------- achievements ----------
export async function checkAchievements(userId: string, ctx: { mode?: GameMode; blackjack21?: boolean; lesson?: boolean; classJoined?: boolean } = {}) {
  const db = admin();
  const [{ data: have }, { data: prof }, { data: ks }, { count: subjCount }, { data: streak }, { count: games }, { count: dailies }] = await Promise.all([
    db.from("user_achievements").select("achievement_id").eq("user_id", userId),
    db.from("profiles").select("xp,class_id").eq("id", userId).single(),
    db.from("knowledge_state").select("subject_id,difficulty,correct").eq("user_id", userId),
    db.from("subjects").select("id", { count: "exact", head: true }).eq("active", true),
    db.rpc("activity_streak", { p_user: userId }),
    db.from("game_sessions").select("id", { count: "exact", head: true }).eq("user_id", userId).neq("status", "active"),
    db.from("game_sessions").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("mode", "daily").eq("status", "finished"),
  ]);
  const owned = new Set((have ?? []).map((h) => h.achievement_id));
  const earn: string[] = [];
  const need = (id: string) => !owned.has(id);
  const level = levelForXp(prof?.xp ?? 0);
  if (need("level_5") && level >= 5) earn.push("level_5");
  if (need("level_10") && level >= 10) earn.push("level_10");
  if (need("class_joined") && (prof?.class_id || ctx.classJoined)) earn.push("class_joined");
  if (need("blackjack_21") && ctx.blackjack21) earn.push("blackjack_21");
  if (ctx.mode && need("first_game") && (games ?? 0) >= 1) earn.push("first_game");
  if (ctx.lesson && need("first_lesson")) earn.push("first_lesson");
  const total = (ks ?? []).reduce((a, r) => a + r.correct, 0);
  if (need("correct_100") && total >= 100) earn.push("correct_100");
  if (need("expert_10") && (ks ?? []).filter((r) => r.difficulty === "expert").reduce((a, r) => a + r.correct, 0) >= 10) earn.push("expert_10");
  if (need("all_subjects") && new Set((ks ?? []).filter((r) => r.correct > 0).map((r) => r.subject_id)).size >= (subjCount ?? 99)) earn.push("all_subjects");
  if (need("streak_3") && Number(streak) >= 3) earn.push("streak_3");
  if (need("streak_7") && Number(streak) >= 7) earn.push("streak_7");
  if (need("daily_5") && (dailies ?? 0) >= 5) earn.push("daily_5");
  if (!earn.length) return [];
  const [, , { data: rows }] = await Promise.all([
    db.from("user_achievements").insert(earn.map((id) => ({ user_id: userId, achievement_id: id }))),
    awardXp(userId, earn.length * 25, earn.length * 10, "achievement", null),
    db.from("achievements").select("id,name,icon").in("id", earn),
  ]);
  return rows ?? [];
}

// ---------- daily challenge ----------
export async function dailyPlan(dateKey: string) {
  const db = admin();
  const { data: subjects } = await db.from("subjects").select("id,name").eq("active", true).order("sort");
  const rnd = seeded(`knowplay-daily-${dateKey}`);
  const subj = (subjects ?? [])[Math.floor(rnd() * (subjects?.length ?? 1))];
  const { data: qs } = await db
    .from("questions")
    .select("id,subject_id,chapter_id,difficulty,qtype,prompt,options,answer,explanation,source")
    .eq("subject_id", subj.id)
    .eq("active", true)
    .is("owner_id", null)
    .in("difficulty", ["easy", "medium", "hard"])
    .order("id");
  const questions = shuffle((qs ?? []) as QuestionRow[], rnd).slice(0, 10);
  return { subject: subj, questions, rnd };
}

export { handTotal, BRAINRUSH_SECONDS };
