import { NextResponse } from "next/server";
import { handler, readJson, requireUser, HttpError, logSecurity, rateLimit } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";

export const POST = handler(async (req) => {
  const { profile } = await requireUser();
  await rateLimit(profile.id, "admin_code", 5, 600);
  const { code } = await readJson<{ code: string }>(req);
  const expected = process.env.ADMIN_CODE;
  if (!expected) throw new HttpError(503, "Ingen adminkod är konfigurerad (ADMIN_CODE saknas i miljön).");
  if (String(code ?? "").trim() !== expected) {
    await logSecurity(profile.id, "admin_code_failed", "warning");
    throw new HttpError(403, "Fel kod");
  }
  await admin().from("profiles").update({ role: "admin" }).eq("id", profile.id);
  await logSecurity(profile.id, "admin_promoted", "info");
  return NextResponse.json({ ok: true });
});
