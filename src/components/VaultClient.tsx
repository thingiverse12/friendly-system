"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "./Toast";
import { useFx } from "./Fx";

type Item = { id: string; kind: "avatar" | "theme" | "frame"; name: string; value: string; price: number; min_level: number };
const KIND: Record<string, string> = { avatar: "Avatarer", theme: "Teman", frame: "Ramar" };

export function VaultClient({ items, owned, coins, level, current }: { items: Item[]; owned: string[]; coins: number; level: number; current: { avatar: string; theme: string } }) {
  const router = useRouter();
  const toast = useToast();
  const fx = useFx();
  const [busy, setBusy] = useState<string | null>(null);
  const [own, setOwn] = useState(new Set(owned));
  const [c, setC] = useState(coins);
  async function buy(it: Item) {
    if (!confirm(`Köp ${it.name} för ${it.price} mynt?`)) return;
    setBusy(it.id);
    try {
      const r = await api<{ coins: number }>("/api/vault/buy", { id: it.id });
      setOwn(new Set([...own, it.id]));
      setC(r.coins);
      fx.play("win");
      toast(`${it.name} är din!`);
      router.refresh();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  async function equip(it: Item) {
    setBusy(it.id);
    try {
      await api("/api/vault/equip", { id: it.id });
      fx.play("coin");
      toast("Utrustad!");
      router.refresh();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  return (
    <>
      {(["avatar", "theme", "frame"] as const).map((kind) => (
        <div className="sec" key={kind}>
          <div className="sec-title">{KIND[kind]}</div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            {items.filter((i) => i.kind === kind).map((it) => {
              const has = own.has(it.id);
              const locked = level < it.min_level;
              const equipped = (kind === "avatar" && current.avatar === it.value) || (kind === "theme" && current.theme === it.value);
              return (
                <div key={it.id} className={`card !p-3 text-center ${locked ? "opacity-60" : ""}`}>
                  <div className="text-3xl h-10">{kind === "avatar" ? it.value : kind === "theme" ? "🎨" : "🖼️"}</div>
                  <b className="block text-[13px] mt-1">{it.name}</b>
                  <p className="muted text-[11px]">{locked ? `Kräver nivå ${it.min_level}` : has ? "Ägd" : `${it.price} mynt`}</p>
                  {has ? (
                    kind !== "frame" ? <button className={`mt-2 ${equipped ? "pill e" : "btn-ghost text-[11px] !py-1.5"}`} disabled={equipped || busy === it.id} onClick={() => equip(it)}>{equipped ? "Används" : "Använd"}</button> : <button className="btn-ghost text-[11px] !py-1.5 mt-2" disabled={busy === it.id} onClick={() => equip(it)}>Använd</button>
                  ) : (
                    <button className="btn-gold text-[11px] !py-1.5 mt-2" disabled={locked || c < it.price || busy === it.id} onClick={() => buy(it)}>{c < it.price ? "För få mynt" : "Köp"}</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}
