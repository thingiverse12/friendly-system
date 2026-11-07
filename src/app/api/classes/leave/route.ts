import { NextResponse } from "next/server";
import { handler, requireUser } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";

export const POST = handler(async () => {
  const { user } = await requireUser();
  await admin().from("profiles").update({ class_id: null, school_id: null }).eq("id", user.id);
  return NextResponse.json({ ok: true });
});
