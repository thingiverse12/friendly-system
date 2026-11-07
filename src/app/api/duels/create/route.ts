import { NextResponse } from "next/server";
import { handler, readJson, requireUser, HttpError, rateLimit } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { createSession, pickQuestions } from "@/lib/engine";
import type { Difficulty } from "@/lib/types";

/** Challenge a classmate. Both get the same 5 questions; the challenger plays immediately. */
export const POST = handler(async (req) => {
  const { profile } = await requireUser();
  await rateLimit(profile.id, "duel", 10, 3600);
  const b = await readJson<{ opponent_id: string; subject: string; difficulty?: Difficulty }>(req);
  if (!profile.class_id) throw new HttpError(400, "Gå med i en klass först");
  const db = admin();
  const { data: opp } = await db.from("profiles").select("id,class_id,alias").eq("id", b.opponent_id).maybeSingle();
  if (!opp || opp.class_id !== profile.class_id) throw new HttpError(403, "Du kan bara utmana klasskompisar");
  if (opp.id === profile.id) throw new HttpError(400, "Du kan inte utmana dig själv");
  const { data: pending } = await db.from("duels").select("id").eq("challenger_id", profile.id).eq("opponent_id", opp.id).in("status", ["pending", "active"]).maybeSingle();
  if (pending) throw new HttpError(409, "Ni har redan en pågående duell");
  const difficulty: Difficulty = ["easy", "medium", "hard"].includes(b.difficulty ?? "") ? b.difficulty! : "medium";
  const questions = await pickQuestions(profile.id, { subjectId: b.subject, difficulties: [difficulty], count: 5, verifiedOnly: true });
  if (questions.length < 3) throw new HttpError(400, "För få frågor i det ämnet");
  const { data: duel, error } = await db.from("duels").insert({ challenger_id: profile.id, opponent_id: opp.id, subject_id: b.subject, difficulty, question_ids: questions.map((q) => q.id) }).select("id").single();
  if (error || !duel) throw new HttpError(500, "Kunde inte skapa duell");
  const sid = await createSession(profile.id, { mode: "duel", subjectId: b.subject, difficulty, questions, competitive: true, meta: { duel_id: duel.id, subject_name: `Duell mot ${opp.alias}` } });
  await db.from("duels").update({ challenger_session: sid, status: "active" }).eq("id", duel.id);
  return NextResponse.json({ id: sid, duel_id: duel.id });
});
