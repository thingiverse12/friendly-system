"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { SchoolPicker } from "./SchoolPicker";

const AVATARS = ["🦊", "🐱", "🐸", "🐵", "🐧", "🐨", "🐯", "🦋"];
const SUGGEST = ["Nordic", "Pixel", "Turbo", "Luna", "Cosmic", "Shadow", "Neon", "Arctic"];
const SUFFIX = ["Fox", "Owl", "Wolf", "Star", "Nova", "Quest", "Byte", "Spark"];

export function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [alias, setAlias] = useState("");
  const [avatar, setAvatar] = useState("🦊");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function suggest() {
    setAlias(SUGGEST[Math.floor(Math.random() * SUGGEST.length)] + SUFFIX[Math.floor(Math.random() * SUFFIX.length)] + Math.floor(Math.random() * 90 + 10));
  }

  async function createProfile() {
    setErr(null);
    setBusy(true);
    try {
      await api("/api/profile", { alias, avatar });
      setStep(1);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-shell no-nav">
      <div className="page pt-10">
        <div className="brand text-[18px]">KNOWPLAY<small>PLAY SMART. LEARN MORE.</small></div>
        <div className="flex gap-1.5 mt-6">{[0, 1].map((i) => <i key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-gold" : "bg-white/10"}`} />)}</div>

        {step === 0 && (
          <div className="fade-up">
            <h1 className="serif text-[20px] font-extrabold mt-6 text-gold">VÄLJ ALIAS</h1>
            <p className="muted text-[13px] mt-1">Ditt alias är det enda andra elever ser. Använd inte ditt riktiga namn.</p>
            <div className="card mt-5 grid gap-4">
              <div>
                <label className="lbl" htmlFor="alias">Alias</label>
                <div className="flex gap-2">
                  <input id="alias" className="input" maxLength={20} value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="t.ex. NordicFox" />
                  <button type="button" className="btn-ghost" onClick={suggest}>🎲</button>
                </div>
              </div>
              <div>
                <label className="lbl">Avatar</label>
                <div className="grid grid-cols-4 gap-2">
                  {AVATARS.map((a) => (
                    <button key={a} type="button" onClick={() => setAvatar(a)} className={`h-16 rounded-2xl text-3xl border ${avatar === a ? "border-gold bg-gold/10" : "border-white/10 bg-white/5"}`}>{a}</button>
                  ))}
                </div>
                <p className="muted text-[11px] mt-2">Fler avatarer låser du upp med mynt i Treasure Vault.</p>
              </div>
              {err && <p className="danger text-[13px]">{err}</p>}
              <button className="btn-gold" disabled={busy || alias.trim().length < 3} onClick={createProfile}>{busy ? "Sparar…" : "FORTSÄTT"}</button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="fade-up">
            <h1 className="serif text-[20px] font-extrabold mt-6 text-gold">DIN KLASS</h1>
            <p className="muted text-[13px] mt-1">Gå med i din klass för att tävla i klass- och skoltävlingar. Du kan hoppa över och göra det senare under Skolor.</p>
            <div className="mt-5">
              <SchoolPicker onDone={() => { router.replace("/home"); router.refresh(); }} />
            </div>
            <button className="btn-ghost w-full mt-4" onClick={() => { router.replace("/home"); router.refresh(); }}>Hoppa över just nu</button>
          </div>
        )}
      </div>
    </main>
  );
}
