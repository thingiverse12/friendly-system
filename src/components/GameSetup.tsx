"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { DIFF_LABEL, DIFF_ORDER } from "@/lib/xp";
import type { Difficulty, GameMode, Subject } from "@/lib/types";

export function GameSetup({ mode, pick, subjects, rec, preset, preferredFormat }: {
  mode: GameMode; pick: "subject+difficulty" | "subject" | "optional-subject" | "none"; subjects: Subject[];
  rec: { subjectId: string; difficulty: Difficulty; perSubject: Record<string, { difficulty: Difficulty; accuracy: number | null; total: number }> };
  preset: { subject?: string; difficulty?: string }; preferredFormat: string;
}) {
  const router = useRouter();
  const [subject, setSubject] = useState<string | null>(pick === "optional-subject" ? preset.subject ?? null : preset.subject ?? rec.subjectId);
  const [difficulty, setDifficulty] = useState<Difficulty>((preset.difficulty as Difficulty) ?? rec.difficulty);
  const [format, setFormat] = useState<string>(preferredFormat);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ id: string }>("/api/game/start", { mode, subject: subject ?? undefined, difficulty: pick === "subject+difficulty" ? difficulty : undefined, format });
      router.push(`/play/${r.id}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }
  const recForSubject = subject ? rec.perSubject[subject]?.difficulty : null;

  return (
    <div className="mt-4 grid gap-4">
      {pick !== "none" && (
        <div>
          <label className="lbl">Ämne {pick === "optional-subject" && <span className="normal-case font-medium">(valfritt)</span>}</label>
          <div className="grid grid-cols-3 gap-2">
            {pick === "optional-subject" && (
              <button type="button" onClick={() => setSubject(null)} className={`rounded-2xl p-3 text-center border ${subject === null ? "border-gold bg-gold/10" : "border-white/10 bg-white/5"}`}>
                <div className="text-2xl">🎲</div><div className="text-[11px] font-bold mt-1">Blandat</div>
              </button>
            )}
            {subjects.map((s) => (
              <button key={s.id} type="button" onClick={() => { setSubject(s.id); if (pick === "subject+difficulty") setDifficulty(rec.perSubject[s.id]?.difficulty ?? "easy"); }} className={`rounded-2xl p-3 text-center border ${subject === s.id ? "border-gold bg-gold/10" : "border-white/10 bg-white/5"}`}>
                <div className="text-2xl">{s.icon}</div>
                <div className="text-[11px] font-bold mt-1">{s.name}</div>
                {rec.perSubject[s.id]?.accuracy !== null && rec.perSubject[s.id]?.accuracy !== undefined && <div className="muted text-[10px]">{Math.round(rec.perSubject[s.id].accuracy! * 100)} %</div>}
              </button>
            ))}
          </div>
        </div>
      )}
      {pick === "subject+difficulty" && (
        <div>
          <label className="lbl">Nivå {recForSubject && <span className="normal-case font-medium">· AI föreslår {DIFF_LABEL[recForSubject]}</span>}</label>
          <div className="seg">
            {DIFF_ORDER.map((d) => <button key={d} type="button" className={difficulty === d ? "on" : ""} onClick={() => setDifficulty(d)}>{DIFF_LABEL[d]}{d === recForSubject ? " ✦" : ""}</button>)}
          </div>
        </div>
      )}
      {mode !== "brainrush" && mode !== "daily" && mode !== "slots" && (
        <div>
          <label className="lbl">Svarsformat</label>
          <div className="seg">
            {[["auto", "Auto (AI)"], ["choice", "Alternativ"], ["written", "Skriva"], ["mixed", "Blandat"]].map(([v, l]) => (
              <button key={v} type="button" className={format === v ? "on" : ""} onClick={() => setFormat(v)}>{l}</button>
            ))}
          </div>
          <p className="muted text-[11px] mt-1.5">Auto låter AI:n välja format utifrån hur du presterar – du kan alltid byta.</p>
        </div>
      )}
      {err && <p className="danger text-[13px]">{err}</p>}
      <button className="btn-gold w-full !py-4 text-[15px]" disabled={busy || (pick === "subject" && !subject)} onClick={start}>{busy ? "Förbereder…" : "▶ STARTA"}</button>
    </div>
  );
}
