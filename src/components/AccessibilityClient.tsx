"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "./Toast";
import type { Settings } from "@/lib/types";

type CB = NonNullable<Settings["colorblind"]>;
type Size = NonNullable<Settings["text_size"]>;

const CB_OPTIONS: { v: CB; label: string; desc: string }[] = [
  { v: "none", label: "Standard", desc: "Grönt = rätt, rött = fel" },
  { v: "deuteranopia", label: "Deuteranopi", desc: "Vanligaste röd-grön. Rätt = blått, fel = orange" },
  { v: "protanopia", label: "Protanopi", desc: "Röd-grön (svag röd). Rätt = blått, fel = orange" },
  { v: "tritanopia", label: "Tritanopi", desc: "Blå-gul. Rätt = grönt, fel = rosa-rött" },
  { v: "mono", label: "Svartvitt", desc: "Ingen färgkodning alls – bara former, ikoner och text" },
];
const SIZES: { v: Size; label: string }[] = [{ v: "normal", label: "Normal" }, { v: "large", label: "Stor (+12 %)" }, { v: "xl", label: "Extra stor (+28 %)" }];

export function AccessibilityClient({ settings }: { settings: Settings }) {
  const router = useRouter();
  const toast = useToast();
  const [s, setS] = useState<Settings>(settings);
  const [saving, setSaving] = useState<string | null>(null);

  async function set<K extends keyof Settings>(k: K, v: Settings[K]) {
    setS((prev) => ({ ...prev, [k]: v }));
    setSaving(String(k));
    try {
      await api("/api/profile/settings", { [k]: v }, "PATCH");
      router.refresh();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setSaving(null);
    }
  }
  const Toggle = ({ k, label, desc, icon }: { k: keyof Settings; label: string; desc: string; icon: string }) => (
    <div className="flex items-center gap-3 py-3 border-b border-[var(--line)] last:border-0">
      <span className="text-2xl w-9 text-center" aria-hidden>{icon}</span>
      <div className="flex-1"><b className="text-[15px]">{label}</b><p className="muted text-[12px]">{desc}</p></div>
      <button type="button" className={`toggle ${s[k] ? "on" : ""}`} role="switch" aria-checked={!!s[k]} aria-label={label} disabled={saving === k} onClick={() => set(k, !s[k] as never)} />
    </div>
  );

  return (
    <div className="grid gap-4">
      <div className="card">
        <div className="sec-title !text-[11px] mb-1">Läsa</div>
        <Toggle k="dyslexia" icon="🔤" label="Dyslexi-läge" desc="Lättläst typsnitt (Lexend), luftigare text och radavstånd, inga VERSALER eller spärrade rubriker." />
        <div className="py-3">
          <div className="flex items-center gap-3"><span className="text-2xl w-9 text-center" aria-hidden>🔎</span><div className="flex-1"><b className="text-[15px]">Textstorlek</b><p className="muted text-[12px]">Gör allt i appen större – knappar och kort följer med.</p></div></div>
          <div className="seg mt-3" role="radiogroup" aria-label="Textstorlek">
            {SIZES.map((o) => <button key={o.v} type="button" role="radio" aria-checked={(s.text_size ?? "normal") === o.v} className={(s.text_size ?? "normal") === o.v ? "on" : ""} onClick={() => set("text_size", o.v)}>{o.label}</button>)}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="sec-title !text-[11px] mb-1">Se</div>
        <div className="flex items-center gap-3 pt-2"><span className="text-2xl w-9 text-center" aria-hidden>🎨</span><div className="flex-1"><b className="text-[15px]">Färgseende</b><p className="muted text-[12px]">Välj den typ som passar dig – rätt/fel får färger som du kan skilja på, och vi visar alltid ikon + text också.</p></div></div>
        <div className="grid gap-2 mt-3" role="radiogroup" aria-label="Färgseende">
          {CB_OPTIONS.map((o) => {
            const on = (s.colorblind ?? "none") === o.v;
            return (
              <button key={o.v} type="button" role="radio" aria-checked={on} className={`opt ${on ? "sel" : ""}`} onClick={() => set("colorblind", o.v)}>
                <span className="k">{on ? "●" : "○"}</span>
                <span className="flex-1"><b className="block text-[14px]">{o.label}</b><span className="muted text-[12px]">{o.desc}</span></span>
              </button>
            );
          })}
        </div>
        <div className="flex gap-2 mt-3 text-[12px]">
          <span className="pill" style={{ color: "var(--ok)", borderColor: "var(--ok)" }}>✓ Så ser RÄTT ut</span>
          <span className="pill" style={{ color: "var(--bad)", borderColor: "var(--bad)" }}>✗ Så ser FEL ut</span>
        </div>
        <Toggle k="high_contrast" icon="◐" label="Hög kontrast" desc="Tydligare kanter, starkare text och färger. Bra vid nedsatt syn eller i solljus." />
      </div>

      <div className="card">
        <div className="sec-title !text-[11px] mb-1">Fokus & lugn</div>
        <Toggle k="focus_mode" icon="🎯" label="Fokusläge" desc="Tar bort konfetti, flygande XP och dekor under spel. Bra vid ADHD eller när man vill ha det lugnt." />
        <Toggle k="animations" icon="✨" label="Animationer" desc="Stäng av för helt stillastående gränssnitt (rörelsekänslighet)." />
        <Toggle k="sound" icon="🔊" label="Ljud" desc="Ljudeffekter vid rätt, fel och vinster." />
        <Toggle k="haptics" icon="📳" label="Vibration" desc="Haptisk feedback på mobil." />
      </div>

      <div className="card text-[12px] muted">
        <b className="text-text">Fler sätt KNOWPLAY anpassar sig:</b> välj svarsformat (alternativ istället för att skriva) under Inställningar, låt AI-läraren förklara med egna ord, och spela i din egen takt – inga tidsgränser utom i Brain Rush. Saknar du något? Säg till din lärare eller skriv till oss.
      </div>
    </div>
  );
}
