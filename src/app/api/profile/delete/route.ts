import { NextResponse } from "next/server";
import { handler, requireUser } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** GDPR: deletes the auth user; all profile data cascades. */
export const POST = handler(async () => {
  const { user } = await requireUser({ allowNoProfile: true });
  await admin().from("security_events").delete().eq("user_id", user.id);
  const { error } = await admin().auth.admin.deleteUser(user.id);
  if (error) throw new Error(error.message);
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
});
