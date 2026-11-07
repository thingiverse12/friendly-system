"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "./Toast";
import { DIFF_LABEL } from "@/lib/xp";

type Duel = { id: string; status: string; subject: string; difficulty: string; isChallenger: boolean; mySession: string | null; winner: "me" | "them" | null; other: { alias: string; avatar: string }; created_at: string };

export function DuelsClient({ mates, subjects, duels }: { mates: { id: string; alias: string; avatar: string }[]; subjects: { id: string; name: string; icon: string }[]; duels: Duel[] }) {
  const router = useRouter();
  const toast = useToast();
  const [opp, setOpp] = useState<string | null>(null);
  const [subject, setSubject] = useState(subjects[0]?.id);
  const [difficulty, setDifficulty] = useState("medium");
  const [busy, setBusy] = useState(false);
  async function create() {
    setBusy(true);
    try {
      const r = await api<{ id: string }>("/api/duels/create", { opponent_id: opp, subject, difficulty });
      router.push(`/play/${r.id}`);
    } catch (e) {
      toast((e as Error).message);
      setBusy(false);
    }
  }
  async function respond(id: string, accept: boolean) {
    setBusy(true);
    try {
      const r = await api<{ id?: string }>("/api/duels/respond", { duel_id: id, accept });
      if (r.id) router.push(`/play/${r.id}`);
      else router.refresh();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const incoming = duels.filter((d) => !d.isChallenger && d.status === "active" && !d.mySession);
  return (
    <>
      {incoming.length > 0 && (
        <div className="card purple mb-4">
          <div className="sec-title !text-[11px] mb-2">Utmaningar till dig</div>
          {incoming.map((d) => (
            <div key={d.id} className="flex items-center gap-3 py-2">
              <span className="text-2xl">{d.other.avatar}</span>
              <div className="flex-1"><b className="text-[14px]">{d.other.alias}</b><p className="muted text-[11px]">{d.subject} · {DIFF_LABEL[d.difficulty as keyof typeof DIFF_LABEL]} · 5 frågor</p></div>
              <button className="btn-gold text-[11px] !py-2" disabled={busy} onClick={() => respond(d.id, true)}>Anta</button>
              <button className="btn-ghost text-[11px] !py-2" disabled={busy} onClick={() => respond(d.id, false)}>Nej</button>
            </div>
          ))}
        </div>
      )}
      <div className="card grid gap-3">
        <div className="sec-title !text-[11px]">Ny duell</div>
        {mates.length === 0 && <p className="muted text-[13px]">Inga klasskompisar har gått med än. Dela klasskoden under Skolor!</p>}
        <div className="flex gap-2 flex-wrap">
          {mates.map((m) => <button key={m.id} type="button" onClick={() => setOpp(m.id)} className={`pill !py-2 ${opp === m.id ? "g" : ""}`}>{m.avatar} {m.alias}</button>)}
        </div>
        <select className="input" value={subject} onChange={(e) => setSubject(e.target.value)}>{subjects.map((s) => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}</select>
        <div className="seg">{["easy", "medium", "hard"].map((d) => <button key={d} type="button" className={difficulty === d ? "on" : ""} onClick={() => setDifficulty(d)}>{DIFF_LABEL[d as keyof typeof DIFF_LABEL]}</button>)}</div>
        <button className="btn-gold" disabled={busy || !opp} onClick={create}>⚔️ UTMANA</button>
        <p className="muted text-[11px]">Båda får samma 5 frågor. Flest rätt vinner (+30 XP), vid lika vinner den snabbaste. Tävlingsläge: facit efter rundan.</p>
      </div>
      <div className="sec">
        <div className="sec-title">Historik</div>
        <div className="card mt-3 !py-2">
          {duels.length === 0 && <p className="muted text-[13px] py-3">Inga dueller än.</p>}
          {duels.map((d) => (
            <div key={d.id} className="rank-row">
              <span className="text-xl">{d.other.avatar}</span>
              <div className="flex-1"><b className="text-[13px]">{d.isChallenger ? "Du utmanade" : "Utmanad av"} {d.other.alias}</b><p className="muted text-[11px]">{d.subject} · {new Date(d.created_at).toLocaleDateString("sv-SE")}</p></div>
              {d.status === "finished" ? <span className={`pill ${d.winner === "me" ? "g" : d.winner === "them" ? "r" : ""}`}>{d.winner === "me" ? "Vinst" : d.winner === "them" ? "Förlust" : "Oavgjort"}</span>
                : d.status === "declined" ? <span className="pill">Avböjd</span>
                : d.mySession ? <Link href={`/play/${d.mySession}`} className="pill e">{d.isChallenger ? "Väntar på svar" : "Spela"}</Link>
                : <span className="pill p">Väntar</span>}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
