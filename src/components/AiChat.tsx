"use client";
import { useRef, useState } from "react";
import { api } from "@/lib/api";

type Msg = { role: "user" | "assistant"; content: string };

export function AiChat({ context, online, providerName }: { context: string | null; online: boolean; providerName: string | null }) {
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "assistant", content: context ? `Hej! Vad vill du förstå bättre i ”${context}”? Jag förklarar steg för steg – men ger inte bara facit.` : "Hej! Jag är din AI-lärare. Fråga om något du pluggar på, så hjälper jag dig förstå det – utan att bara ge svaret." },
  ]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const m = text.trim();
    if (!m || busy) return;
    const history = [...msgs, { role: "user" as const, content: m }];
    setMsgs(history);
    setText("");
    setBusy(true);
    try {
      const r = await api<{ text: string }>("/api/ai/teacher", { mode: "chat", message: context ? `(Sammanhang: ${context}) ${m}` : m, history: msgs.slice(-8) });
      setMsgs([...history, { role: "assistant", content: r.text }]);
    } catch (er) {
      setMsgs([...history, { role: "assistant", content: (er as Error).message }]);
    } finally {
      setBusy(false);
      setTimeout(() => box.current?.scrollTo({ top: 1e6, behavior: "smooth" }), 50);
    }
  }
  return (
    <div>
      <div className="flex gap-2 flex-wrap">
        <span className={`pill ${online ? "p" : "g"}`}>{online ? `🤖 Online · ${providerName}` : "Offline-läge"}</span>
        <span className="pill">Övningsläge: ledtrådar före facit</span>
      </div>
      <div ref={box} className="card mt-3 h-[52vh] overflow-y-auto grid gap-2 content-start">
        {msgs.map((m, i) => (
          <div key={i} className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[14px] whitespace-pre-wrap ${m.role === "user" ? "justify-self-end bg-gold/15 border border-gold/30" : "bg-[var(--overlay)] border border-[var(--line)]"}`}>{m.content}</div>
        ))}
        {busy && <div className="spinner" />}
      </div>
      <form onSubmit={send} className="flex gap-2 mt-3">
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Förklara fotosyntesen som om jag var 13…" maxLength={1000} />
        <button className="btn-gold" disabled={busy || !text.trim()}>➤</button>
      </form>
      <p className="muted text-[11px] mt-2">AI:n kan ha fel. Dubbelkolla viktiga fakta mot läroboken. Skriv inga personuppgifter.</p>
    </div>
  );
}
