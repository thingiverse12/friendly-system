import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";

export default async function Landing() {
  const { user, profile } = await getSession();
  if (user && profile) redirect("/home");
  if (user && !profile) redirect("/onboarding");
  return (
    <main className="app-shell no-nav">
      <div className="page pt-10">
        <div className="brand text-[22px]">KNOWPLAY<small>PLAY SMART. LEARN MORE.</small></div>
        <div className="play-cta mt-8">
          <div>
            <h2>PLAY</h2>
            <p className="mt-2 text-[13px] text-[#bfe6d3]">Kunskapsspel med casinokänsla – men utan pengar, lootboxar eller stress. Bara du, dina ämnen och klassen.</p>
            <div className="mt-4 flex gap-2 flex-wrap">
              <Link href="/signup" className="btn-gold">SKAPA KONTO</Link>
              <Link href="/login" className="btn-ghost">Logga in</Link>
            </div>
          </div>
        </div>
        <div className="sec">
          <div className="sec-title">Så funkar det</div>
          <div className="grid gap-3 mt-3">
            {[
              ["🎯", "Rätt svar = XP", "Lätt 10 · Medel 25 · Svår 50 · Expert 100. Gissningar och upprepningar ger inget extra."],
              ["🧠", "AI som förstår dig", "Vi skiljer på vad du kan och hur du svarar bäst – byt frågeformat när du vill."],
              ["🃏", "Sex spellägen", "Blackjack, Wheel, Slots, High Stakes, Brain Rush och Dagens utmaning."],
              ["🏫", "Klass mot klass", "Normaliserad poäng – små klasser kan slå stora och ingen kan bära laget ensam."],
              ["🔒", "Säkert för unga", "Alias istället för namn, privata profiler, ingen öppen chatt, all poängräkning på servern."],
            ].map(([i, t, d]) => (
              <div key={t} className="card flex gap-3 items-start">
                <span className="text-2xl">{i}</span>
                <div>
                  <b className="text-[14px]">{t}</b>
                  <p className="muted text-[12px] mt-0.5">{d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="muted text-[11px] mt-8 text-center">Inga riktiga pengar. Inga slumpbelöningar. Bara kunskap.</p>
      </div>
    </main>
  );
}
