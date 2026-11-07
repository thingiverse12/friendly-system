import { NextResponse } from "next/server";
import { handler, requireUser, HttpError, logSecurity } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";

/** Revoke = replace code with an unguessable long token that is never shown. */
export const POST = handler(async () => {
  const { profile } = await requireUser();
  if (!profile.class_id) throw new HttpError(400, "Du är inte med i någon klass");
  const db = admin();
  const { data: cls } = await db.from("classes").select("id,created_by").eq("id", profile.class_id).single();
  if (!(profile.role === "admin" || cls?.created_by === profile.id)) throw new HttpError(403, "Bara den som skapade klassen (eller en admin) kan stänga koden");
  const token = "X-" + crypto.randomUUID().replace(/-/g, "").toUpperCase();
  await db.from("classes").update({ join_code: token }).eq("id", profile.class_id);
  await logSecurity(profile.id, "join_code_revoked", "info", { class_id: profile.class_id });
  return NextResponse.json({ ok: true });
});
