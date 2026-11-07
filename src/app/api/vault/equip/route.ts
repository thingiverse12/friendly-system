import { NextResponse } from "next/server";
import { handler, readJson, requireUser, HttpError } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";

export const POST = handler(async (req) => {
  const { profile } = await requireUser();
  const { id } = await readJson<{ id: string }>(req);
  const db = admin();
  const { data: it } = await db.from("cosmetics").select("*").eq("id", id).maybeSingle();
  if (!it) throw new HttpError(404, "Finns inte");
  const { data: has } = await db.from("user_cosmetics").select("cosmetic_id").eq("user_id", profile.id).eq("cosmetic_id", id).maybeSingle();
  if (!has) throw new HttpError(403, "Du äger inte den här");
  if (it.kind === "avatar") await db.from("profiles").update({ avatar: it.value }).eq("id", profile.id);
  else if (it.kind === "theme") await db.from("profiles").update({ theme: it.value }).eq("id", profile.id);
  else {
    // frames: only one equipped at a time – keep the chosen one, drop other owned frames from "equipped" by re-inserting order (simplest: store in settings)
    const settings = { ...profile.settings, frame: it.value };
    await db.from("profiles").update({ settings }).eq("id", profile.id);
  }
  return NextResponse.json({ ok: true });
});
