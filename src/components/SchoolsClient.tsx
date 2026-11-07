"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { SchoolPicker } from "./SchoolPicker";
import { useToast } from "./Toast";

export function SchoolsClient(props: { mode: "join" } | { mode: "manage"; joinCode: string | null; canManage: boolean; schoolId: string; classId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [code, setCode] = useState(props.mode === "manage" ? props.joinCode : null);
  const [report, setReport] = useState<null | "school" | "class">(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  if (props.mode === "join") return <SchoolPicker onDone={({ school, label }) => { toast(`Välkommen till ${label} på ${school}!`); router.refresh(); }} />;

  async function copy() {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    toast("Koden kopierad!");
  }
  async function share() {
    if (!code) return;
    const text = `Gå med i vår klass på KNOWPLAY med koden ${code} – ${location.origin}/schools`;
    if (navigator.share) await navigator.share({ title: "KNOWPLAY", text }).catch(() => {});
    else { await navigator.clipboard.writeText(text); toast("Inbjudan kopierad!"); }
  }
  async function act(path: string, ok: string) {
    setBusy(true);
    try {
      const r = await api<{ code?: string }>(path);
      if (path.includes("renew")) setCode(r.code ?? null);
      if (path.includes("revoke")) setCode(null);
      toast(ok);
      router.refresh();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function sendReport() {
    if (props.mode !== "manage") return;
    setBusy(true);
    try {
      await api("/api/schools/report", { target_type: report, target_id: report === "school" ? props.schoolId : props.classId, reason });
      toast("Tack! En admin granskar rapporten.");
      setReport(null);
      setReason("");
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="card mt-4">
      <div className="flex items-center justify-between">
        <b className="text-[14px]">Klasskod</b>
        {code ? <span className="serif text-[20px] tracking-[.3em] gold font-extrabold">{code}</span> : <span className="pill r">Stängd</span>}
      </div>
      <p className="muted text-[11px] mt-1">Dela koden med klasskompisar så de kan gå med. {props.canManage ? "Du kan byta eller stänga koden när som helst." : "Bara den som skapade klassen kan byta kod."}</p>
      <div className="flex gap-2 mt-3 flex-wrap">
        {code && <button className="btn-ghost text-[12px]" onClick={copy}>📋 Kopiera</button>}
        {code && <button className="btn-ghost text-[12px]" onClick={share}>📤 Dela</button>}
        {props.canManage && <button className="btn-ghost text-[12px]" disabled={busy} onClick={() => act("/api/classes/renew", "Ny kod skapad")}>🔄 Ny kod</button>}
        {props.canManage && code && <button className="btn-ghost text-[12px]" disabled={busy} onClick={() => confirm("Stäng koden? Ingen kan gå med förrän du skapar en ny.") && act("/api/classes/revoke", "Koden är stängd")}>⛔ Stäng</button>}
      </div>
      <div className="flex gap-2 mt-4 pt-3 border-t border-[var(--line)] flex-wrap">
        <button className="btn-ghost text-[12px]" onClick={() => setReport("school")}>⚠ Rapportera dubblett av skola</button>
        <button className="btn-ghost text-[12px]" onClick={() => setReport("class")}>⚠ Rapportera klass</button>
        <button className="btn-ghost text-[12px] ml-auto" disabled={busy} onClick={() => confirm("Lämna klassen?") && act("/api/classes/leave", "Du har lämnat klassen")}>Lämna</button>
      </div>
      {report && (
        <div className="mt-3 grid gap-2">
          <textarea className="input" placeholder={report === "school" ? "Vilken skola är den en dubblett av? Beskriv." : "Vad är fel med klassen?"} value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex gap-2"><button className="btn-gold" disabled={busy || reason.length < 5} onClick={sendReport}>Skicka</button><button className="btn-ghost" onClick={() => setReport(null)}>Avbryt</button></div>
        </div>
      )}
    </div>
  );
}
