"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "./Toast";
import { useFx } from "./Fx";

export function LessonActions({ id, alreadyDone, nextHref, nextLabel }: { id: string; alreadyDone: boolean; nextHref: string; nextLabel: string }) {
  const [done, setDone] = useState(alreadyDone);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const fx = useFx();
  const router = useRouter();
  async function complete() {
    setBusy(true);
    try {
      const r = await api<{ xp: number; already: boolean; achievements?: { name: string }[] }>(`/api/lessons/${id}/complete`);
      setDone(true);
      fx.play("coin");
      toast(r.already ? "Redan klar" : `+${r.xp} XP – lektionen är klar!${r.achievements?.length ? " 🏅 " + r.achievements.map((a) => a.name).join(", ") : ""}`);
      router.refresh();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function test() {
    setBusy(true);
    try {
      const r = await api<{ id: string }>(`/api/lessons/${id}/test`);
      router.push(`/play/${r.id}`);
    } catch (e) {
      toast((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-2 mt-4">
      {!done ? (
        <button className="btn-gold w-full !py-4" disabled={busy} onClick={complete}>✓ MARKERA SOM KLAR</button>
      ) : (
        <Link href={nextHref} className="btn-gold w-full !py-4">{nextLabel} →</Link>
      )}
      <button className="btn-ghost w-full" disabled={busy} onClick={test}>📝 Testa dig på kapitlet (6 frågor)</button>
    </div>
  );
}
