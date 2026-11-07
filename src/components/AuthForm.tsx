"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const supabase = createClient();
    try {
      if (mode === "signup") {
        if (password.length < 8) throw new Error("Lösenordet måste vara minst 8 tecken.");
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) {
          const { error: e2 } = await supabase.auth.signInWithPassword({ email, password });
          if (e2) throw new Error("Kontot skapades – kontrollera din e-post för att bekräfta, och logga sedan in.");
        }
        router.replace("/onboarding");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error("Fel e-post eller lösenord.");
        router.replace("/home");
      }
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-shell no-nav">
      <div className="page pt-10">
        <Link href="/" className="brand text-[18px]">KNOWPLAY<small>PLAY SMART. LEARN MORE.</small></Link>
        <h1 className="serif text-[20px] font-extrabold mt-8 text-gold">{mode === "signup" ? "SKAPA KONTO" : "LOGGA IN"}</h1>
        <p className="muted text-[13px] mt-1">
          {mode === "signup" ? "Du väljer ett alias i nästa steg – ditt riktiga namn visas aldrig." : "Välkommen tillbaka."}
        </p>
        <form onSubmit={submit} className="card mt-6 grid gap-4">
          <div>
            <label className="lbl" htmlFor="email">E-post</label>
            <input id="email" className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="lbl" htmlFor="pw">Lösenord</label>
            <input id="pw" className="input" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={mode === "signup" ? 8 : 1} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {err && <p className="danger text-[13px]">{err}</p>}
          <button className="btn-gold" disabled={busy}>{busy ? "Vänta…" : mode === "signup" ? "FORTSÄTT" : "LOGGA IN"}</button>
        </form>
        <p className="muted text-[13px] mt-5 text-center">
          {mode === "signup" ? (
            <>Har du redan konto? <Link href="/login" className="gold font-bold">Logga in</Link></>
          ) : (
            <>Ny här? <Link href="/signup" className="gold font-bold">Skapa konto</Link></>
          )}
        </p>
        {mode === "signup" && (
          <p className="muted text-[11px] mt-6 text-center">
            Vi sparar bara e-post, lösenord (krypterat), alias och din spelstatistik. Du kan radera kontot när som helst under Profil.
          </p>
        )}
      </div>
    </main>
  );
}
