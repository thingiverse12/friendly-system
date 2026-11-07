"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "./Toast";

/** Small button that posts an admin action and refreshes. */
export function AdminAction({ body, label, confirmText, className = "btn-ghost text-[11px] !py-1.5", prompt }: { body: Record<string, unknown>; label: string; confirmText?: string; className?: string; prompt?: { key: string; text: string } }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function go() {
    if (confirmText && !confirm(confirmText)) return;
    const extra: Record<string, unknown> = {};
    if (prompt) {
      const v = window.prompt(prompt.text);
      if (v === null) return;
      extra[prompt.key] = v;
    }
    setBusy(true);
    try {
      await api("/api/admin", { ...body, ...extra });
      toast("Klart");
      router.refresh();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return <button className={className} disabled={busy} onClick={go}>{label}</button>;
}

export function AdminForm({ action, fields, label }: { action: string; fields: { key: string; label: string; type?: string; placeholder?: string; options?: string[] }[]; label: string }) {
  const router = useRouter();
  const toast = useToast();
  const [vals, setVals] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/admin", { action, ...vals });
      toast("Sparat");
      setVals({});
      router.refresh();
    } catch (er) {
      toast((er as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="grid gap-2 md:grid-cols-[1fr_1fr_auto] items-end">
      {fields.map((f) => (
        <div key={f.key}>
          <label className="lbl">{f.label}</label>
          {f.options ? (
            <select className="input" value={vals[f.key] ?? ""} onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })}><option value="">Välj…</option>{f.options.map((o) => <option key={o}>{o}</option>)}</select>
          ) : (
            <input className="input" type={f.type ?? "text"} placeholder={f.placeholder} value={vals[f.key] ?? ""} onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })} />
          )}
        </div>
      ))}
      <button className="btn-gold" disabled={busy}>{label}</button>
    </form>
  );
}
