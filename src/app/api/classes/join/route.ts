import { NextResponse } from "next/server";
import { handler, readJson, requireUser, HttpError, rateLimit } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { checkAchievements } from "@/lib/engine";

/** Join by class id (picked from list) or by join code. */
export const POST = handler(async (req) => {
  const { user } = await requireUser();
  await rateLimit(user.id, "class_join", 10, 600);
  const body = await readJson<{ class_id?: string; code?: string }>(req);
  const db = admin();
  let q = db.from("classes").select("id,school_id,label,year,schools(name)");
  if (body.code) q = q.eq("join_code", String(body.code).trim().toUpperCase());
  else if (body.class_id) q = q.eq("id", body.class_id);
  else throw new HttpError(400, "Ange kod eller klass");
  const { data: cls } = await q.maybeSingle();
  if (!cls) throw new HttpError(404, body.code ? "Ingen klass med den koden" : "Klassen finns inte");
  await db.from("profiles").update({ school_id: cls.school_id, class_id: cls.id }).eq("id", user.id);
  await checkAchievements(user.id, { classJoined: true });
  return NextResponse.json({ ok: true, class: { id: cls.id, label: cls.label, year: cls.year, school: (cls.schools as unknown as { name: string })?.name } });
});
