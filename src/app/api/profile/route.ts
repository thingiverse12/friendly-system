import { NextResponse } from "next/server";
import { handler, readJson, requireUser, HttpError } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";

const ALIAS_RE = /^[A-Za-z0-9ÅÄÖåäö_]{3,20}$/;
const BANNED = ["admin", "knowplay", "lärare", "larare", "moderator"];

/** Create profile (onboarding). */
export const POST = handler(async (req) => {
  const { user, profile } = await requireUser({ allowNoProfile: true });
  if (profile) throw new HttpError(409, "Profil finns redan");
  const body = await readJson<{ alias: string; avatar: string }>(req);
  const alias = String(body.alias ?? "").trim();
  if (!ALIAS_RE.test(alias)) throw new HttpError(400, "Alias: 3–20 tecken, bokstäver/siffror/_");
  if (BANNED.some((b) => alias.toLowerCase().includes(b))) throw new HttpError(400, "Det aliaset är inte tillåtet");
  const avatar = String(body.avatar || "🦊").slice(0, 4);
  const { error } = await admin().from("profiles").insert({ id: user.id, alias, avatar, coins: 50 });
  if (error) throw new HttpError(error.code === "23505" ? 409 : 400, error.code === "23505" ? "Aliaset är upptaget" : "Kunde inte skapa profil");
  await admin().from("user_cosmetics").insert([{ user_id: user.id, cosmetic_id: "av_fox" }, { user_id: user.id, cosmetic_id: "th_noir" }]);
  return NextResponse.json({ ok: true });
});

/** Update alias/avatar/theme. */
export const PATCH = handler(async (req) => {
  const { user, profile } = await requireUser();
  const body = await readJson<{ alias?: string; avatar?: string; theme?: string }>(req);
  const patch: Record<string, string> = {};
  if (body.alias !== undefined) {
    const alias = body.alias.trim();
    if (!ALIAS_RE.test(alias)) throw new HttpError(400, "Alias: 3–20 tecken, bokstäver/siffror/_");
    if (BANNED.some((b) => alias.toLowerCase().includes(b))) throw new HttpError(400, "Det aliaset är inte tillåtet");
    patch.alias = alias;
  }
  if (body.avatar !== undefined || body.theme !== undefined) {
    const { data: owned } = await admin().from("user_cosmetics").select("cosmetic_id, cosmetics(kind,value)").eq("user_id", user.id);
    const has = (kind: string, value: string) =>
      (owned ?? []).some((o) => {
        const c = o.cosmetics as unknown as { kind: string; value: string } | null;
        return c?.kind === kind && c?.value === value;
      });
    if (body.avatar !== undefined) {
      const free = ["🦊", "🐱", "🐸", "🐵", "🐧", "🐨", "🐯", "🦋"];
      if (!free.includes(body.avatar) && !has("avatar", body.avatar)) throw new HttpError(403, "Du äger inte den avataren");
      patch.avatar = body.avatar;
    }
    if (body.theme !== undefined) {
      if (body.theme !== "noir" && !has("theme", body.theme)) throw new HttpError(403, "Du äger inte det temat");
      patch.theme = body.theme;
    }
  }
  if (!Object.keys(patch).length) return NextResponse.json({ ok: true });
  const { error } = await admin().from("profiles").update(patch).eq("id", profile.id);
  if (error) throw new HttpError(error.code === "23505" ? 409 : 400, error.code === "23505" ? "Aliaset är upptaget" : "Kunde inte spara");
  return NextResponse.json({ ok: true });
});
