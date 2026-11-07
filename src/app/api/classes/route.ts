import { NextResponse } from "next/server";
import { handler, readJson, requireUser, HttpError, rateLimit } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { uniqueJoinCode } from "@/lib/schools";
import { checkAchievements } from "@/lib/engine";

/** Create a class in a school and join it. */
export const POST = handler(async (req) => {
  const { user } = await requireUser();
  await rateLimit(user.id, "class_create", 5, 3600);
  const body = await readJson<{ school_id: string; year: number; label: string }>(req);
  const year = Number(body.year);
  const label = String(body.label ?? "").trim().toUpperCase().slice(0, 12);
  if (!body.school_id || !(year >= 1 && year <= 12) || label.length < 1) throw new HttpError(400, "Ange årskurs och klassbeteckning");
  const db = admin();
  const { data: school } = await db.from("schools").select("id").eq("id", body.school_id).is("merged_into", null).maybeSingle();
  if (!school) throw new HttpError(404, "Skolan finns inte");
  const { data: existing } = await db.from("classes").select("id,join_code").eq("school_id", school.id).eq("year", year).ilike("label", label).maybeSingle();
  let cls = existing;
  if (!cls) {
    const { data, error } = await db.from("classes").insert({ school_id: school.id, year, label, join_code: await uniqueJoinCode(), created_by: user.id }).select("id,join_code").single();
    if (error) throw new HttpError(500, "Kunde inte skapa klass");
    cls = data;
  }
  await db.from("profiles").update({ school_id: school.id, class_id: cls!.id }).eq("id", user.id);
  await checkAchievements(user.id, { classJoined: true });
  return NextResponse.json({ class: cls, existed: !!existing });
});
