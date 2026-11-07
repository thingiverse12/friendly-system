"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "./Toast";

export function QuestionEditor({ subjects, chapters }: { subjects: { id: string; name: string }[]; chapters: { id: string; title: string; subject_id: string }[] }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ subject_id: subjects[0]?.id ?? "", chapter_id: "", difficulty: "medium", qtype: "mcq", prompt: "", options: "", answer: "", explanation: "" });
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      let options: unknown = null;
      let answer: unknown;
      const opts = f.options.split("\n").map((s) => s.trim()).filter(Boolean);
      if (f.qtype === "mcq") { options = opts; answer = Number(f.answer); if (!(answer as number >= 0) || (answer as number) >= opts.length) throw new Error("Svar = index (0-baserat) bland alternativen"); }
      else if (f.qtype === "tf") answer = /^(sant|true|ja|1)$/i.test(f.answer);
      else if (f.qtype === "numeric") { const [v, t] = f.answer.split(/[;±]/).map((x) => Number(x.replace(",", "."))); answer = { value: v, tol: t || 0 }; }
      else if (f.qtype === "match") { const [l, r] = f.options.split("\n---\n"); options = { left: l.split("\n").filter(Boolean), right: r.split("\n").filter(Boolean) }; answer = f.answer.split(",").map((x) => Number(x.trim())); }
      else answer = f.answer.split("|").map((s) => s.trim()).filter(Boolean);
      await api("/api/admin", { action: "create_question", question: { ...f, chapter_id: f.chapter_id || null, options, answer } });
      toast("Frågan skapad");
      setF({ ...f, prompt: "", options: "", answer: "", explanation: "" });
      router.refresh();
    } catch (er) {
      toast((er as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!open) return <button className="btn-gold justify-self-start" onClick={() => setOpen(true)}>+ Ny verifierad fråga</button>;
  return (
    <form onSubmit={submit} className="card grid gap-2 md:grid-cols-2">
      <select className="input" value={f.subject_id} onChange={(e) => setF({ ...f, subject_id: e.target.value, chapter_id: "" })}>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      <select className="input" value={f.chapter_id} onChange={(e) => setF({ ...f, chapter_id: e.target.value })}><option value="">Inget kapitel</option>{chapters.filter((c) => c.subject_id === f.subject_id).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
      <select className="input" value={f.difficulty} onChange={(e) => setF({ ...f, difficulty: e.target.value })}>{["easy", "medium", "hard", "expert"].map((d) => <option key={d}>{d}</option>)}</select>
      <select className="input" value={f.qtype} onChange={(e) => setF({ ...f, qtype: e.target.value })}>{["mcq", "tf", "fill", "numeric", "short", "match"].map((d) => <option key={d}>{d}</option>)}</select>
      <textarea className="input md:col-span-2" placeholder="Frågetext" value={f.prompt} onChange={(e) => setF({ ...f, prompt: e.target.value })} required />
      {(f.qtype === "mcq" || f.qtype === "match") && <textarea className="input md:col-span-2" placeholder={f.qtype === "mcq" ? "Alternativ, ett per rad" : "Vänster, ett per rad\n---\nHöger, ett per rad"} value={f.options} onChange={(e) => setF({ ...f, options: e.target.value })} />}
      <input className="input" placeholder={{ mcq: "Rätt index (0 = första)", tf: "sant / falskt", fill: "Accepterade svar | separerade", numeric: "värde;tolerans t.ex. 3.14;0.01", short: "nyckelord | separerade", match: "höger-index per vänster, t.ex. 1,0,2" }[f.qtype]} value={f.answer} onChange={(e) => setF({ ...f, answer: e.target.value })} required />
      <input className="input" placeholder="Förklaring" value={f.explanation} onChange={(e) => setF({ ...f, explanation: e.target.value })} />
      <div className="flex gap-2"><button className="btn-gold" disabled={busy}>Spara</button><button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Stäng</button></div>
    </form>
  );
}
