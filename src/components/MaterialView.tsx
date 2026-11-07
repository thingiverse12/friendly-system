"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "./Toast";

export function MaterialView({ id, concepts, flashcards, questionCount }: { id: string; concepts: { term: string; definition: string }[]; flashcards: { front: string; back: string }[]; questionCount: number }) {
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();
  async function practice() {
    setBusy(true);
    try {
      const r = await api<{ id: string }>(`/api/materials/${id}/practice`);
      router.push(`/play/${r.id}`);
    } catch (e) {
      toast((e as Error).message);
      setBusy(false);
    }
  }
  async function remove() {
    if (!confirm("Ta bort materialet och dess frågor?")) return;
    await api("/api/materials", { id }, "DELETE");
    router.replace("/learn/materials");
    router.refresh();
  }
  return (
    <>
      {questionCount > 0 && <button className="btn-gold w-full mt-4 !py-4" disabled={busy} onClick={practice}>▶ ÖVA PÅ FRÅGORNA ({questionCount})</button>}
      <div className="sec">
        <div className="sec-title">Begrepp</div>
        <div className="card mt-3 grid gap-2">
          {concepts.length === 0 && <p className="muted text-[13px]">Inga begrepp hittades.</p>}
          {concepts.map((c, k) => (
            <div key={k} className="border-b border-white/10 last:border-0 pb-2 last:pb-0">
              <b className="text-[14px] gold">{c.term}</b>
              <p className="text-[13px] mt-0.5">{c.definition}</p>
            </div>
          ))}
        </div>
      </div>
      {flashcards.length > 0 && (
        <div className="sec">
          <div className="sec-title">Flashcards · {i + 1}/{flashcards.length}</div>
          <button type="button" onClick={() => setFlip(!flip)} className={`card felt mt-3 w-full min-h-[160px] text-left grid place-items-center text-center ${flip ? "" : ""}`}>
            <div>
              <span className="pill g mb-2">{flip ? "SVAR" : "FRÅGA"}</span>
              <p className="text-[16px] font-bold mt-2">{flip ? flashcards[i].back : flashcards[i].front}</p>
              <p className="muted text-[11px] mt-3">Tryck för att vända</p>
            </div>
          </button>
          <div className="flex gap-2 mt-3">
            <button className="btn-ghost flex-1" onClick={() => { setFlip(false); setI((i - 1 + flashcards.length) % flashcards.length); }}>‹ Föregående</button>
            <button className="btn-ghost flex-1" onClick={() => { setFlip(false); setI((i + 1) % flashcards.length); }}>Nästa ›</button>
          </div>
        </div>
      )}
      <button className="btn-danger w-full mt-8" onClick={remove}>Ta bort material</button>
    </>
  );
}
