import { NextResponse } from "next/server";
import { handler, requireUser, HttpError } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { createSession, formatsFromPreference, pickQuestions, recommend } from "@/lib/engine";

/** Chapter test: 6 questions from the lesson's chapter, mixed difficulty. */
export const POST = handler(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const { profile } = await requireUser();
  const { id } = await ctx.params;
  const db = admin();
  const { data: lesson } = await db.from("lessons").select("id,chapter_id,chapters(subject_id,title)").eq("id", id).maybeSingle();
  if (!lesson) throw new HttpError(404, "Lektionen finns inte");
  const ch = lesson.chapters as unknown as { subject_id: string; title: string };
  const rec = await recommend(profile.id);
  const formats = formatsFromPreference(profile.settings.preferred_format, rec.formats);
  const { data: chapterQs } = await db.from("questions").select("id").eq("chapter_id", lesson.chapter_id).eq("active", true);
  const ids = (chapterQs ?? []).map((q) => q.id);
  let questions = await pickQuestions(profile.id, { subjectId: ch.subject_id, difficulties: ["easy", "medium", "hard"], count: 40, formats, verifiedOnly: true });
  questions = questions.filter((q) => ids.includes(q.id!)).slice(0, 6);
  if (questions.length < 3) questions = (await pickQuestions(profile.id, { subjectId: ch.subject_id, difficulties: ["easy", "medium"], count: 6, formats, verifiedOnly: true }));
  const sid = await createSession(profile.id, { mode: "lesson", subjectId: ch.subject_id, difficulty: null, questions, meta: { subject_name: ch.title } });
  return NextResponse.json({ id: sid });
});
