"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export function MaterialUpload({ subjects }: { subjects: { id: string; name: string }[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [subject, setSubject] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/\.(txt|md|markdown|csv)$/i.test(f.name)) {
      setErr("Just nu stöds textfiler (.txt, .md). Kopiera texten ur PDF/Word och klistra in den här istället.");
      return;
    }
    const t = await f.text();
    setText(t.slice(0, 20000));
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ id: string }>("/api/materials", { title, text, subject: subject || null });
      router.push(`/learn/materials/${r.id}`);
    } catch (er) {
      setErr((er as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card grid gap-3">
      <div>
        <label className="lbl">Titel</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="t.ex. Kemi – kap 4 anteckningar" maxLength={100} required />
      </div>
      <div>
        <label className="lbl">Ämne</label>
        <select className="input" value={subject} onChange={(e) => setSubject(e.target.value)}>
          <option value="">Välj ämne (valfritt)</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div>
        <label className="lbl">Text ({text.length.toLocaleString("sv-SE")}/20 000 tecken)</label>
        <textarea className="input min-h-[160px]" value={text} onChange={(e) => setText(e.target.value.slice(0, 20000))} placeholder="Klistra in anteckningar, ett kapitel ur läroboken eller en text läraren delat…" />
        <label className="btn-ghost mt-2 text-[12px] cursor-pointer">
          📎 Välj textfil (.txt/.md)
          <input type="file" accept=".txt,.md,.markdown,.csv,text/plain" className="hidden" onChange={onFile} />
        </label>
      </div>
      <p className="muted text-[11px]">AI:n får bara använda det som står i texten och hittar inte på fakta. Resultatet märks ”AI-genererat – ej verifierat” och delas inte med andra. Ladda inte upp personuppgifter.</p>
      {err && <p className="danger text-[13px]">{err}</p>}
      <button className="btn-gold" disabled={busy || text.trim().length < 200 || !title.trim()}>{busy ? "Analyserar… (kan ta 20–40 s)" : "SKAPA STUDIEPAKET"}</button>
    </form>
  );
}
