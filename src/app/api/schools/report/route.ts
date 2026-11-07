import { NextResponse } from "next/server";
import { handler, readJson, requireUser, HttpError, rateLimit } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";

/** Generic report (duplicate school/class, bad question, suspicious result…). */
export const POST = handler(async (req) => {
  const { user } = await requireUser();
  await rateLimit(user.id, "report", 10, 3600);
  const body = await readJson<{ target_type: string; target_id: string; reason: string }>(req);
  if (!["school", "class", "user", "question", "material", "result"].includes(body.target_type)) throw new HttpError(400, "Ogiltig typ");
  const reason = String(body.reason ?? "").trim().slice(0, 500);
  if (reason.length < 5) throw new HttpError(400, "Beskriv problemet (minst 5 tecken)");
  await admin().from("reports").insert({ reporter_id: user.id, target_type: body.target_type, target_id: String(body.target_id), reason });
  return NextResponse.json({ ok: true });
});
