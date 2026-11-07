import { NextResponse } from "next/server";
import { handler, readJson, requireUser, HttpError, rateLimit } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { chat, MATERIAL_SYSTEM, offlineMaterial, parseJson, activeProvider } from "@/lib/ai";

type Gen = { title?: string; summary: string; concepts: { term: string; definition: string }[]; flashcards: { front: string; back: string }[]; questions?: { difficulty: string; prompt: string; options: string[]; answer: number; explanation: string }[] };

/** Upload text (pasted or from a .txt/.md file) → AI study material + private practice questions. */
export const POST = handler(async (req) => {
  const { profile } = await requireUser();
  await rateLimit(profile.id, "material", 10, 3600);
  const b = await readJson<{ title: string; text: string; subject?: string | null }>(req);
  const text = String(b.text ?? "").replace(/\r/g, "").trim();
  const title = String(b.title ?? "").trim().slice(0, 100) || "Mitt material";
  if (text.length < 200) throw new HttpError(400, "Texten är för kort (minst 200 tecken) för att ge bra material.");
  if (text.length > 20000) throw new HttpError(400, "Max 20 000 tecken per uppladdning.");
  const db = admin();
  const subject = b.subject || null;
  const { data: mat, error } = await db.from("materials").insert({ user_id: profile.id, subject_id: subject, title, raw_text: text, status: "pending" }).select("id").single();
  if (error || !mat) throw new HttpError(500, "Kunde inte spara materialet");

  let gen: Gen | null = null;
  let status: "ready" | "offline" | "failed" = "offline";
  if (activeProvider()) {
    try {
      const r = await chat([{ role: "system", content: MATERIAL_SYSTEM }, { role: "user", content: `Titel: ${title}\n\nTEXT:\n${text.slice(0, 16000)}` }], { json: true });
      gen = r ? parseJson<Gen>(r.text) : null;
      status = gen?.summary ? "ready" : "failed";
    } catch (e) {
      console.error(e);
      status = "failed";
    }
  }
  if (!gen) {
    const off = offlineMaterial(text);
    gen = { summary: off.summary, concepts: off.concepts, flashcards: off.flashcards, questions: [] };
    if (status === "failed") status = "offline";
  }
  await db.from("materials").update({ summary: gen.summary, concepts: gen.concepts ?? [], flashcards: gen.flashcards ?? [], status }).eq("id", mat.id);
  const qs = (gen.questions ?? [])
    .filter((q) => q && q.prompt && Array.isArray(q.options) && q.options.length >= 2 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length)
    .slice(0, 10)
    .map((q) => ({
      subject_id: subject ?? "svenska", chapter_id: null, difficulty: ["easy", "medium", "hard"].includes(q.difficulty) ? q.difficulty : "medium", qtype: "mcq",
      prompt: String(q.prompt).slice(0, 400), options: q.options.map((o) => String(o).slice(0, 200)), answer: q.answer, explanation: String(q.explanation ?? "").slice(0, 500),
      source: "ai", owner_id: profile.id, material_id: mat.id,
    }));
  if (qs.length) await db.from("questions").insert(qs);
  return NextResponse.json({ id: mat.id, status, questions: qs.length });
});

export const DELETE = handler(async (req) => {
  const { profile } = await requireUser();
  const { id } = await readJson<{ id: string }>(req);
  await admin().from("materials").delete().eq("id", id).eq("user_id", profile.id);
  return NextResponse.json({ ok: true });
});
