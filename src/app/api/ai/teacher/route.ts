import { NextResponse } from "next/server";
import { handler, readJson, requireUser, rateLimit } from "@/lib/auth";
import { chat, TEACHER_SYSTEM, activeProvider, type ChatMessage } from "@/lib/ai";

const OFFLINE = "AI-läraren är i offline-läge. Här är den verifierade förklaringen:";

export const POST = handler(async (req) => {
  const { profile } = await requireUser();
  await rateLimit(profile.id, "ai", 30, 3600);
  const b = await readJson<{ prompt: string; subject?: string; your_answer?: string | null; correct_answer?: string | null; explanation?: string | null; mode: "after" | "hint" | "chat"; message?: string; history?: { role: "user" | "assistant"; content: string }[] }>(req);
  if (!activeProvider()) {
    const text = b.mode === "chat"
      ? "AI-läraren är i offline-läge: AI är avstängd på servern. Under tiden hittar du förklaringar i lektionerna under Lär."
      : `${OFFLINE}\n\n${b.explanation ?? "Ingen förklaring finns sparad för den här frågan."}`;
    return NextResponse.json({ text, offline: true });
  }
  const messages: ChatMessage[] = [{ role: "system", content: TEACHER_SYSTEM }];
  if (b.mode === "chat") {
    for (const h of (b.history ?? []).slice(-8)) messages.push({ role: h.role, content: String(h.content).slice(0, 1500) });
    messages.push({ role: "user", content: String(b.message ?? "").slice(0, 1500) });
  } else if (b.mode === "hint") {
    messages.push({ role: "user", content: `Ämne: ${b.subject ?? "okänt"}. Frågan lyder: "${b.prompt}". Eleven har INTE svarat än. Ge en ledtråd och en kontrollfråga – avslöja inte svaret.` });
  } else {
    messages.push({ role: "user", content: `Ämne: ${b.subject ?? "okänt"}. Frågan: "${b.prompt}". Eleven svarade ${b.your_answer === "rätt" ? "RÄTT" : "FEL"}. Rätt svar: ${b.correct_answer ?? "okänt"}. Verifierad förklaring: ${b.explanation ?? "saknas"}. Förklara varför på ett sätt som bygger förståelse, ge ett liknande exempel, och avsluta med ett tips för att komma ihåg det.` });
  }
  try {
    const r = await chat(messages);
    return NextResponse.json({ text: r?.text?.trim() || "Jag kunde inte formulera ett svar just nu.", offline: false, provider: r?.provider.label });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ text: `AI-tjänsten svarade inte just nu. ${b.explanation ? "Verifierad förklaring: " + b.explanation : ""}`, offline: true });
  }
});
