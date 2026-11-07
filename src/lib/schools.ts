import { admin } from "./supabase/admin";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function makeJoinCode() {
  let s = "";
  for (let i = 0; i < 6; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}
export async function uniqueJoinCode() {
  for (let i = 0; i < 10; i++) {
    const code = makeJoinCode();
    const { data } = await admin().from("classes").select("id").eq("join_code", code).maybeSingle();
    if (!data) return code;
  }
  throw new Error("Kunde inte skapa kod");
}
export function normalizeName(s: string) {
  return s.replace(/\s+/g, " ").trim().replace(/\b(skola|skolan)\b/gi, (m) => m.toLowerCase());
}
