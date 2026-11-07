import { NextResponse } from "next/server";
import { handler, readJson, requireUser, HttpError, rateLimit } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { BRAINRUSH_SECONDS, createSession, dailyPlan, formatsFromPreference, generateArithmetic, pickQuestions, recommend } from "@/lib/engine";
import { DIFF_ORDER, levelForXp, todayKey } from "@/lib/xp";
import type { Difficulty, GameMode, QType } from "@/lib/types";

const MODES: GameMode[] = ["quick", "blackjack", "wheel", "slots", "highstakes", "brainrush", "daily"];

export const POST = handler(async (req) => {
  const { profile } = await requireUser();
  await rateLimit(profile.id, "session_start", 20, 300);
  const body = await readJson<{ mode: GameMode; subject?: string; difficulty?: Difficulty; count?: number; format?: string; chapter?: string }>(req);
  if (!MODES.includes(body.mode)) throw new HttpError(400, "Okänt spelläge");
  const db = admin();

  // Resume an active session of the same mode instead of creating a new one
  const { data: active } = await db.from("game_sessions").select("id").eq("user_id", profile.id).eq("mode", body.mode).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (active && body.mode !== "quick") return NextResponse.json({ id: active.id, resumed: true });
  if (active) await db.from("game_sessions").update({ status: "abandoned", finished_at: new Date().toISOString() }).eq("id", active.id);

  const rec = await recommend(profile.id);
  const { data: subjects } = await db.from("subjects").select("id,name,icon").eq("active", true).order("sort");
  const subjectIds = (subjects ?? []).map((s) => s.id);
  const formats = formatsFromPreference(body.format ?? profile.settings.preferred_format, rec.formats);
  const difficultyFor = (sid: string): Difficulty => rec.perSubject[sid]?.difficulty ?? "easy";
  const validSubject = (s?: string) => (s && subjectIds.includes(s) ? s : null);
  const validDiff = (d?: string): Difficulty | null => (d && DIFF_ORDER.includes(d as Difficulty) ? (d as Difficulty) : null);

  switch (body.mode) {
    case "quick": {
      const subject = validSubject(body.subject) ?? rec.subjectId;
      const difficulty = validDiff(body.difficulty) ?? difficultyFor(subject);
      const count = Math.min(Math.max(Number(body.count) || 8, 4), 15);
      const questions = await pickQuestions(profile.id, { subjectId: subject, difficulties: [difficulty], count, formats });
      const id = await createSession(profile.id, { mode: "quick", subjectId: subject, difficulty, questions, meta: { subject_name: subjects?.find((s) => s.id === subject)?.name } });
      return NextResponse.json({ id });
    }
    case "blackjack": {
      const subject = validSubject(body.subject) ?? rec.subjectId;
      const base = difficultyFor(subject);
      const i = DIFF_ORDER.indexOf(base);
      const diffs = [DIFF_ORDER[Math.max(0, i - 1)], base, DIFF_ORDER[Math.min(3, i + 1)]];
      const questions = await pickQuestions(profile.id, { subjectId: subject, difficulties: [...new Set(diffs)], count: 12, formats });
      const id = await createSession(profile.id, { mode: "blackjack", subjectId: subject, difficulty: base, questions, meta: { hand: [], subject_name: subjects?.find((s) => s.id === subject)?.name } });
      return NextResponse.json({ id });
    }
    case "wheel": {
      // Server picks the subject – the client only animates to the chosen index.
      const idx = Math.floor(Math.random() * subjectIds.length);
      const subject = subjectIds[idx];
      const difficulty = difficultyFor(subject);
      const questions = await pickQuestions(profile.id, { subjectId: subject, difficulties: [difficulty], count: 6, formats });
      const id = await createSession(profile.id, { mode: "wheel", subjectId: subject, difficulty, questions, meta: { wheel: { index: idx, subjects: subjects?.map((s) => ({ id: s.id, icon: s.icon, name: s.name })) }, subject_name: subjects?.[idx]?.name } });
      return NextResponse.json({ id });
    }
    case "slots": {
      const subject = subjectIds[Math.floor(Math.random() * subjectIds.length)];
      const recDiff = difficultyFor(subject);
      const ri = DIFF_ORDER.indexOf(recDiff);
      const pool: Difficulty[] = [recDiff, recDiff, DIFF_ORDER[Math.max(0, ri - 1)], DIFF_ORDER[Math.min(3, ri + 1)]];
      const difficulty = pool[Math.floor(Math.random() * pool.length)];
      const types: QType[][] = [["mcq"], ["tf"], ["fill", "numeric"], ["match", "short"]];
      const typeLabel = ["Flerval", "Sant/falskt", "Skriv svar", "Para ihop / kort"];
      const ti = Math.floor(Math.random() * types.length);
      const questions = await pickQuestions(profile.id, { subjectId: subject, difficulties: [difficulty], count: 6, formats: types[ti] });
      const subj = subjects?.find((s) => s.id === subject);
      const id = await createSession(profile.id, { mode: "slots", subjectId: subject, difficulty, questions, meta: { reels: { subject: subj?.icon, subject_name: subj?.name, difficulty, type: typeLabel[ti] }, subject_name: subj?.name } });
      return NextResponse.json({ id });
    }
    case "highstakes": {
      const subject = validSubject(body.subject);
      const plan: Difficulty[] = ["easy", "easy", "medium", "medium", "medium", "hard", "hard", "hard", "expert", "expert"];
      const questions = [];
      const used: string[] = [];
      for (const d of plan) {
        const sid = subject ?? subjectIds[Math.floor(Math.random() * subjectIds.length)];
        const [q] = await pickQuestions(profile.id, { subjectId: sid, difficulties: [d], count: 1, formats, exclude: used });
        if (q) { questions.push(q); used.push(q.id!); }
      }
      const id = await createSession(profile.id, { mode: "highstakes", subjectId: subject, difficulty: null, questions, meta: { stakes: plan, subject_name: subject ? subjects?.find((s) => s.id === subject)?.name : "Blandade ämnen" } });
      return NextResponse.json({ id });
    }
    case "brainrush": {
      const level = levelForXp(profile.xp);
      const questions = generateArithmetic(25, level);
      const deadline = new Date(Date.now() + BRAINRUSH_SECONDS * 1000).toISOString();
      const id = await createSession(profile.id, { mode: "brainrush", subjectId: "matematik", difficulty: "easy", questions, meta: { deadline, subject_name: "Huvudräkning" } });
      return NextResponse.json({ id });
    }
    case "daily": {
      const key = todayKey();
      const start = new Date(`${key}T00:00:00+01:00`);
      const { data: existing } = await db.from("game_sessions").select("id,status").eq("user_id", profile.id).eq("mode", "daily").gte("created_at", new Date(start.getTime() - 3600000).toISOString()).limit(1).maybeSingle();
      if (existing) return NextResponse.json({ id: existing.id, resumed: true });
      const plan = await dailyPlan(key);
      const id = await createSession(profile.id, { mode: "daily", subjectId: plan.subject.id, difficulty: "medium", questions: plan.questions, competitive: true, meta: { label: `Dagens utmaning ${key}`, subject_name: plan.subject.name }, rnd: plan.rnd });
      return NextResponse.json({ id });
    }
  }
  throw new HttpError(400, "Okänt spelläge");
});
