import { NextResponse } from "next/server";
import { handler, readJson, requireUser, HttpError } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { createSession, type QuestionRow } from "@/lib/engine";

export const POST = handler(async (req) => {
  const { profile } = await requireUser();
  const b = await readJson<{ duel_id: string; accept: boolean }>(req);
  const db = admin();
  const { data: d } = await db.from("duels").select("*, challenger:profiles!duels_challenger_id_fkey(alias)").eq("id", b.duel_id).eq("opponent_id", profile.id).maybeSingle();
  if (!d) throw new HttpError(404, "Duellen finns inte");
  if (d.opponent_session) return NextResponse.json({ id: d.opponent_session });
  if (!b.accept) {
    await db.from("duels").update({ status: "declined", finished_at: new Date().toISOString() }).eq("id", d.id);
    return NextResponse.json({ ok: true });
  }
  const { data: qs } = await db.from("questions").select("id,subject_id,chapter_id,difficulty,qtype,prompt,options,answer,explanation,source").in("id", d.question_ids);
  const ordered = (d.question_ids as string[]).map((id) => (qs ?? []).find((q) => q.id === id)).filter(Boolean) as QuestionRow[];
  const sid = await createSession(profile.id, { mode: "duel", subjectId: d.subject_id, difficulty: d.difficulty, questions: ordered, competitive: true, meta: { duel_id: d.id, subject_name: `Duell mot ${(d.challenger as unknown as { alias: string })?.alias ?? "?"}` } });
  await db.from("duels").update({ opponent_session: sid, status: "active" }).eq("id", d.id);
  return NextResponse.json({ id: sid });
});
