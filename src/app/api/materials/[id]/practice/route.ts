import { NextResponse } from "next/server";
import { handler, requireUser, HttpError } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { createSession, type QuestionRow } from "@/lib/engine";
import { shuffle } from "@/lib/grading";

export const POST = handler(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const { profile } = await requireUser();
  const { id } = await ctx.params;
  const db = admin();
  const { data: mat } = await db.from("materials").select("id,title,subject_id").eq("id", id).eq("user_id", profile.id).maybeSingle();
  if (!mat) throw new HttpError(404, "Materialet finns inte");
  const { data: qs } = await db.from("questions").select("id,subject_id,chapter_id,difficulty,qtype,prompt,options,answer,explanation,source").eq("material_id", id).eq("owner_id", profile.id).eq("active", true);
  if (!qs?.length) throw new HttpError(400, "Inga AI-frågor finns för det här materialet (offline-läge). Lägg till en AI-nyckel för att generera frågor.");
  const sid = await createSession(profile.id, { mode: "quick", subjectId: mat.subject_id, difficulty: null, questions: shuffle(qs as QuestionRow[]).slice(0, 10), meta: { subject_name: mat.title } });
  return NextResponse.json({ id: sid });
});
