import { NextResponse } from "next/server";
import { handler, readJson, requireUser } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";

const KEYS = ["sound", "haptics", "animations", "preferred_format", "public_profile", "show_school", "reminders", "dyslexia", "colorblind", "text_size", "high_contrast", "focus_mode"] as const;
const ENUMS: Record<string, string[]> = {
  preferred_format: ["auto", "choice", "written", "mixed"],
  colorblind: ["none", "deuteranopia", "protanopia", "tritanopia", "mono"],
  text_size: ["normal", "large", "xl"],
};

export const PATCH = handler(async (req) => {
  const { profile } = await requireUser();
  const body = await readJson<Record<string, unknown>>(req);
  const next = { ...profile.settings } as Record<string, unknown>;
  for (const k of KEYS) {
    if (k in body) {
      if (k in ENUMS) {
        if (ENUMS[k].includes(String(body[k]))) next[k] = body[k];
      } else next[k] = Boolean(body[k]);
    }
  }
  await admin().from("profiles").update({ settings: next }).eq("id", profile.id);
  return NextResponse.json({ ok: true, settings: next });
});
