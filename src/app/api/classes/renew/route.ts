import { NextResponse } from "next/server";
import { handler, requireUser, HttpError, logSecurity } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { uniqueJoinCode } from "@/lib/schools";

/** Renew join code. Allowed for class creator, admins, or any member if the creator left. */
export const POST = handler(async () => {
  const { profile } = await requireUser();
  if (!profile.class_id) throw new HttpError(400, "Du är inte med i någon klass");
  const db = admin();
  const { data: cls } = await db.from("classes").select("id,created_by").eq("id", profile.class_id).single();
  const { data: creator } = cls?.created_by ? await db.from("profiles").select("id,class_id").eq("id", cls.created_by).maybeSingle() : { data: null };
  const creatorStillMember = creator && creator.class_id === profile.class_id;
  if (!(profile.role === "admin" || cls?.created_by === profile.id || !creatorStillMember)) throw new HttpError(403, "Bara den som skapade klassen (eller en admin) kan byta kod");
  const code = await uniqueJoinCode();
  await db.from("classes").update({ join_code: code }).eq("id", profile.class_id);
  await logSecurity(profile.id, "join_code_renewed", "info", { class_id: profile.class_id });
  return NextResponse.json({ code });
});
