import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { getSession } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { MODE_LABEL } from "@/lib/xp";

export const metadata = { title: "Spel" };
export const dynamic = "force-dynamic";

const GAMES = [
  { href: "/games/quick", icon: "🎯", name: "QUICK PLAY", sub: "Välj ämne och nivå – 8 frågor", g: "linear-gradient(160deg,#134e4a,#042f2e)" },
  { href: "/games/daily", icon: "📅", name: "DAGENS UTMANING", sub: "Samma frågor för alla · räknas till klassen", g: "linear-gradient(160deg,#4c1d95,#1e1033)" },
  { href: "/games/blackjack", icon: "🃏", name: "KNOWLEDGE BLACKJACK", sub: "Rätt svar = nytt kort. Nå 21.", g: "linear-gradient(160deg,#0f3b2a,#071a12)" },
  { href: "/games/wheel", icon: "🎡", name: "KNOWLEDGE WHEEL", sub: "Hjulet väljer ämne", g: "linear-gradient(160deg,#3b2a6b,#160f2e)" },
  { href: "/games/slots", icon: "🎰", name: "KNOWLEDGE SLOTS", sub: "Ämne · Nivå · Frågetyp", g: "linear-gradient(160deg,#5a3a0a,#1f1403)" },
  { href: "/games/highstakes", icon: "💎", name: "HIGH STAKES QUIZ", sub: "10 frågor, stigande svårighet", g: "linear-gradient(160deg,#6b1d2a,#2a0a10)" },
  { href: "/games/brainrush", icon: "⚡", name: "BRAIN RUSH", sub: "Huvudräkning på 60 sekunder", g: "linear-gradient(160deg,#1e3a8a,#0b1540)" },
  { href: "/duels", icon: "⚔️", name: "DUELLER", sub: "1 mot 1 med klasskompis", g: "linear-gradient(160deg,#78350f,#1c0a02)" },
];

export default async function Games() {
  const { profile } = await getSession();
  const { data: active } = await admin().from("game_sessions").select("id,mode,answered:total,correct,created_at").eq("user_id", profile!.id).eq("status", "active").order("created_at", { ascending: false }).limit(3);
  const { data: recent } = await admin().from("game_sessions").select("id,mode,correct,total,xp_awarded,status,created_at").eq("user_id", profile!.id).neq("status", "active").order("created_at", { ascending: false }).limit(5);
  return (
    <>
      <TopBar title="Spel" />
      <div className="page">
        {active && active.length > 0 && (
          <div className="sec !mt-2">
            <div className="sec-title">Pågående</div>
            {active.map((a) => (
              <Link key={a.id} href={`/play/${a.id}`} className="card interactive mt-3 flex items-center gap-3">
                <span className="text-2xl">▶️</span>
                <div className="flex-1"><b className="text-[14px]">{MODE_LABEL[a.mode]}</b><p className="muted text-[12px]">Fortsätt där du slutade</p></div>
              </Link>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 mt-4">
          {GAMES.map((g) => (
            <Link key={g.href} href={g.href} className="gcard wide" style={{ ["--g" as string]: g.g, height: 170 }}>
              <span className="ic">{g.icon}</span>
              <b>{g.name}</b>
              <small>{g.sub}</small>
            </Link>
          ))}
        </div>
        <div className="card mt-4 text-[12px] muted">
          <b className="text-text">Så fungerar XP:</b> Lätt 10 · Medel 25 · Svår 50 · Expert 100. Fel svar ger 0 XP men alltid en förklaring. Samma fråga igen ger 50 %, sedan 25 %, sedan 0. Blixtsnabba gissningar halveras. Allt räknas på servern.
        </div>
        {recent && recent.length > 0 && (
          <div className="sec">
            <div className="sec-title">Senaste rundor</div>
            <div className="card mt-3 !p-2">
              {recent.map((r) => (
                <Link key={r.id} href={`/play/${r.id}`} className="rank-row !px-2">
                  <span className="text-lg">{r.status === "bust" ? "💥" : "🏁"}</span>
                  <div className="flex-1"><b className="text-[13px]">{MODE_LABEL[r.mode]}</b><p className="muted text-[11px]">{new Date(r.created_at).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" })}</p></div>
                  <span className="text-[12px]">{r.correct}/{r.total}</span>
                  <span className="pill e">+{r.xp_awarded}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
