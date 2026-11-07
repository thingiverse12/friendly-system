import { NextResponse } from "next/server";
import { handler, readJson, requireUser, HttpError } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { levelForXp } from "@/lib/xp";

export const POST = handler(async (req) => {
  const { profile } = await requireUser();
  const { id } = await readJson<{ id: string }>(req);
  const db = admin();
  const { data: it } = await db.from("cosmetics").select("*").eq("id", id).maybeSingle();
  if (!it) throw new HttpError(404, "Finns inte");
  if (levelForXp(profile.xp) < it.min_level) throw new HttpError(403, `Kräver nivå ${it.min_level}`);
  const { data: has } = await db.from("user_cosmetics").select("cosmetic_id").eq("user_id", profile.id).eq("cosmetic_id", id).maybeSingle();
  if (has) throw new HttpError(409, "Du äger redan den här");
  const { data: ok } = await db.rpc("spend_coins", { p_user: profile.id, p_amount: it.price });
  if (!ok) throw new HttpError(402, "Inte tillräckligt med mynt");
  await db.from("user_cosmetics").insert({ user_id: profile.id, cosmetic_id: id });
  const { data: p } = await db.from("profiles").select("coins").eq("id", profile.id).single();
  return NextResponse.json({ ok: true, coins: p?.coins ?? 0 });
});
