import { NextResponse } from "next/server";
import { handler, readJson, requireUser, HttpError, rateLimit } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { normalizeName } from "@/lib/schools";

/** Create an (unverified) school. Returns an existing one if the name+city already exists. */
export const POST = handler(async (req) => {
  const { user } = await requireUser({ allowNoProfile: true });
  await rateLimit(user.id, "school_create", 5, 3600);
  const body = await readJson<{ name: string; city: string }>(req);
  const name = normalizeName(String(body.name ?? ""));
  const city = normalizeName(String(body.city ?? ""));
  if (name.length < 3 || name.length > 80) throw new HttpError(400, "Ange skolans namn (3–80 tecken)");
  if (city.length < 2 || city.length > 60) throw new HttpError(400, "Ange ort");
  const { data: existing } = await admin().from("schools").select("id,name,city,verified").ilike("name", name).ilike("city", city).is("merged_into", null).maybeSingle();
  if (existing) return NextResponse.json({ school: existing, existed: true });
  const { data, error } = await admin().from("schools").insert({ name, city, created_by: user.id }).select("id,name,city,verified").single();
  if (error) throw new HttpError(500, "Kunde inte skapa skola");
  return NextResponse.json({ school: data, existed: false });
});
