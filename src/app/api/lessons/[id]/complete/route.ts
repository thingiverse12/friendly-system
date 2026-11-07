import { NextResponse } from "next/server";
import { handler, requireUser, HttpError } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { checkAchievements } from "@/lib/engine";

export const POST = handler(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const { profile } = await requireUser();
  const { id } = await ctx.params;
  const db = admin();
  const { data: lesson } = await db.from("lessons").select("id,xp_reward,title").eq("id", id).maybeSingle();
  if (!lesson) throw new HttpError(404, "Lektionen finns inte");
  const { data: done } = await db.from("lesson_progress").select("lesson_id").eq("user_id", profile.id).eq("lesson_id", id).maybeSingle();
  if (done) return NextResponse.json({ ok: true, xp: 0, already: true });
  await db.from("lesson_progress").insert({ user_id: profile.id, lesson_id: id });
  await db.rpc("award_xp", { p_user: profile.id, p_amount: lesson.xp_reward, p_coins: Math.ceil(lesson.xp_reward * 0.2), p_reason: "lesson:complete", p_session: null });
  const achievements = await checkAchievements(profile.id, { lesson: true });
  return NextResponse.json({ ok: true, xp: lesson.xp_reward, achievements });
});
