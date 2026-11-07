"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "./Toast";
import type { Settings } from "@/lib/types";

const THEME_LABEL: Record<string, string> = { noir: "Casino Noir", ljus: "Dagsljus", emerald: "Emerald", royal: "Royal Blue", violet: "Violet" };

export function SettingsClient({ profile, avatars, themes, email }: { profile: { alias: string; avatar: string; theme: string; role: string; settings: Settings }; avatars: string[]; themes: string[]; email: string }) {
  const router = useRouter();
  const toast = useToast();
  const [alias, setAlias] = useState(profile.alias);
  const [avatar, setAvatar] = useState(profile.avatar);
  const [theme, setTheme] = useState(profile.theme);
  const [s, setS] = useState<Settings>(profile.settings);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function saveProfile() {
    setBusy(true);
    try {
      await api("/api/profile", { alias, avatar, theme }, "PATCH");
      toast("Sparat!");
      router.refresh();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function toggle<K extends keyof Settings>(k: K, v: Settings[K]) {
    const next = { ...s, [k]: v };
    setS(next);
    try {
      await api("/api/profile/settings", { [k]: v }, "PATCH");
      router.refresh();
    } catch (e) {
      toast((e as Error).message);
    }
  }
  async function promote() {
    setBusy(true);
    try {
      await api("/api/profile/admin-code", { code });
      toast("Du är nu admin!");
      router.refresh();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function del() {
    if (!confirm("Radera kontot permanent? All din data (profil, XP, historik, material) tas bort. Detta går inte att ångra.")) return;
    if (!confirm("Är du helt säker?")) return;
    await api("/api/profile/delete");
    location.href = "/";
  }
  const Row = ({ k, label, desc }: { k: keyof Settings; label: string; desc: string }) => (
    <div className="flex items-center gap-3 py-2.5 border-b border-[var(--line)] last:border-0">
      <div className="flex-1"><b className="text-[14px]">{label}</b><p className="muted text-[11px]">{desc}</p></div>
      <button type="button" className={`toggle ${s[k] ? "on" : ""}`} aria-pressed={!!s[k]} onClick={() => toggle(k, !s[k] as never)} />
    </div>
  );
  return (
    <div className="grid gap-4">
      <a href="/profile/accessibility" className="card interactive flex items-center gap-3"><span className="text-2xl">♿</span><div><b className="text-[14px]">Tillgänglighet</b><p className="muted text-[12px]">Dyslexi-läge · färgblindhet · textstorlek · hög kontrast · fokusläge</p></div><span className="ml-auto gold">›</span></a>
      <div className="card grid gap-3">
        <div className="sec-title !text-[11px]">Profil</div>
        <div><label className="lbl">Alias</label><input className="input" value={alias} maxLength={20} onChange={(e) => setAlias(e.target.value)} /></div>
        <div>
          <label className="lbl">Avatar</label>
          <div className="flex gap-2 flex-wrap">{avatars.map((a) => <button key={a} type="button" onClick={() => setAvatar(a)} className={`w-12 h-12 rounded-xl text-2xl border ${avatar === a ? "border-gold bg-gold/10" : "border-[var(--line)] bg-[var(--overlay)]"}`}>{a}</button>)}</div>
        </div>
        <div>
          <label className="lbl">Tema</label>
          <div className="seg">{themes.map((t) => <button key={t} type="button" className={theme === t ? "on" : ""} onClick={() => setTheme(t)}>{THEME_LABEL[t] ?? t}</button>)}</div>
          <p className="muted text-[11px] mt-1">Fler teman och avatarer finns i Treasure Vault.</p>
        </div>
        <button className="btn-gold" disabled={busy} onClick={saveProfile}>SPARA</button>
      </div>

      <div className="card">
        <div className="sec-title !text-[11px] mb-1">Svarsformat</div>
        <div className="seg mt-2">
          {[["auto", "Auto (AI)"], ["choice", "Alternativ"], ["written", "Skriva"], ["mixed", "Blandat"]].map(([v, l]) => (
            <button key={v} type="button" className={s.preferred_format === v ? "on" : ""} onClick={() => toggle("preferred_format", v as Settings["preferred_format"])}>{l}</button>
          ))}
        </div>
        <p className="muted text-[11px] mt-2">Auto: AI:n väljer format utifrån din statistik (t.ex. fler flerval om du kan mer än du får fram i skrift). Du bestämmer alltid själv.</p>
      </div>

      <div className="card">
        <div className="sec-title !text-[11px] mb-1">Upplevelse</div>
        <Row k="sound" label="Ljud" desc="Korta ljudeffekter vid rätt/fel och vinster" />
        <Row k="haptics" label="Vibration" desc="Haptisk feedback på mobil" />
        <Row k="animations" label="Animationer" desc="Stäng av för lugnare läge" />
        <Row k="reminders" label="Påminnelser" desc="Visa påminnelse om dagens utmaning på startsidan" />
      </div>

      <div className="card">
        <div className="sec-title !text-[11px] mb-1">Integritet</div>
        <Row k="public_profile" label="Offentlig profil" desc="Visa alias i topplistor. Avstängd = du syns som ”Privat elev”." />
        <Row k="show_school" label="Visa skola" desc="Visa skola/klass bredvid ditt alias i nationella listor" />
        <p className="muted text-[11px] mt-2">Vi sparar: e-post ({email}), alias, avatar, spelstatistik och ditt uppladdade material. Inget säljs eller delas. Inga annonser.</p>
      </div>

      {profile.role !== "admin" && (
        <div className="card">
          <div className="sec-title !text-[11px] mb-1">Adminkod</div>
          <p className="muted text-[11px]">Har du fått en adminkod av den som driver plattformen? Ange den här.</p>
          <div className="flex gap-2 mt-2"><input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Kod" /><button className="btn-ghost" disabled={busy || !code} onClick={promote}>Aktivera</button></div>
        </div>
      )}

      <div className="card border-red-500/30">
        <div className="sec-title !text-[11px] mb-1">Radera konto</div>
        <p className="muted text-[11px]">Tar bort allt om dig permanent (GDPR, rätten att bli glömd).</p>
        <button className="btn-danger mt-3" onClick={del}>Radera mitt konto</button>
      </div>
    </div>
  );
}
