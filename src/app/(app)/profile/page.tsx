import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { Avatar } from "@/components/Avatar";
import { getSession } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { getStreak } from "@/lib/data";
import { levelProgress, MODE_LABEL, RANKS } from "@/lib/xp";

export const metadata = { title: "Profil" };
export const dynamic = "force-dynamic";

export default async function Profile() {
  const { profile } = await getSession();
  const p = profile!;
  const db = admin();
  const [{ data: ach }, { data: mine }, { data: ks }, { data: sessions }, streak, { data: frame }, { count: lessonsDone }] = await Promise.all([
    db.from("achievements").select("*").order("sort"),
    db.from("user_achievements").select("achievement_id,earned_at").eq("user_id", p.id),
    db.from("knowledge_state").select("subject_id,correct,total,subjects(name,icon)").eq("user_id", p.id),
    db.from("game_sessions").select("id,mode,correct,total,xp_awarded,status,created_at").eq("user_id", p.id).neq("status", "active").order("created_at", { ascending: false }).limit(8),
    getStreak(p.id),
    db.from("user_cosmetics").select("cosmetic_id,cosmetics(kind,value)").eq("user_id", p.id),
    db.from("lesson_progress").select("lesson_id", { count: "exact", head: true }).eq("user_id", p.id),
  ]);
  const lp = levelProgress(p.xp);
  const earned = new Map((mine ?? []).map((m) => [m.achievement_id, m.earned_at]));
  const totalCorrect = (ks ?? []).reduce((a, r) => a + r.correct, 0);
  const totalAns = (ks ?? []).reduce((a, r) => a + r.total, 0);
  const ownedFrames = (frame ?? []).map((f) => f.cosmetics as unknown as { kind: string; value: string }).filter((c) => c?.kind === "frame").map((c) => c.value);
  const wanted = (p.settings as unknown as { frame?: string }).frame;
  const equippedFrame = wanted && ownedFrames.includes(wanted) ? wanted : null;
  const bySubject = new Map<string, { name: string; icon: string; c: number; t: number }>();
  for (const r of ks ?? []) {
    const s = r.subjects as unknown as { name: string; icon: string };
    const e = bySubject.get(r.subject_id) ?? { name: s.name, icon: s.icon, c: 0, t: 0 };
    e.c += r.correct; e.t += r.total;
    bySubject.set(r.subject_id, e);
  }
  return (
    <>
      <TopBar title="Profil" right={<Link href="/profile/settings" className="back" aria-label="Inställningar">⚙️</Link>} />
      <div className="page">
        <div className="card felt flex items-center gap-4">
          <Avatar emoji={p.avatar} pct={lp.pct} size="lg" frame={equippedFrame} />
          <div className="flex-1">
            <h2 className="text-[20px] font-extrabold">{p.alias}</h2>
            <div className="serif text-[11px] tracking-[.14em] text-gold">{lp.rank.toUpperCase()} · NIVÅ {lp.level}</div>
            <div className="xpbar mt-2"><b style={{ width: `${lp.pct}%` }} /></div>
            <p className="muted text-[11px] mt-1">{p.xp.toLocaleString("sv-SE")} XP · {lp.toNext} till nästa nivå</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="stat"><b>{p.coins}</b><span>mynt</span></div>
          <div className="stat"><b>{totalAns ? Math.round((totalCorrect / totalAns) * 100) : 0}%</b><span>rätt ({totalCorrect}/{totalAns})</span></div>
          <div className="stat"><b>{streak}</b><span>dagars streak</span></div>
        </div>
        <div className="flex gap-2 mt-3">
          <Link href="/vault" className="btn-gold flex-1">💎 Treasure Vault</Link>
          <Link href="/profile/settings" className="btn-ghost flex-1">Inställningar</Link>
        </div>
        {p.role === "admin" && <Link href="/admin" className="card interactive mt-3 flex items-center gap-3"><span className="text-2xl">🛡️</span><div><b className="text-[14px]">Adminpanel</b><p className="muted text-[12px]">Användare, frågor, skolor, säkerhet, XP-logg</p></div></Link>}

        <div className="sec">
          <div className="sec-title">Rang-stegen</div>
          <div className="card mt-3 flex justify-between">
            {RANKS.map((r) => <div key={r.name} className={`text-center ${lp.level >= r.from ? "" : "opacity-40"}`}><div className="text-xl">{lp.level >= r.from ? "★" : "☆"}</div><div className="text-[9px] font-extrabold tracking-wide">{r.name.toUpperCase()}</div><div className="muted text-[9px]">niv. {r.from}</div></div>)}
          </div>
        </div>

        <div className="sec">
          <div className="sec-title">Kunskap per ämne</div>
          <div className="card mt-3 grid gap-2">
            {bySubject.size === 0 && <p className="muted text-[13px]">Spela en runda så börjar statistiken fyllas på.</p>}
            {[...bySubject.values()].map((s) => (
              <div key={s.name} className="flex items-center gap-2 text-[13px]">
                <span>{s.icon}</span><span className="w-24 font-semibold">{s.name}</span>
                <div className="xpbar flex-1"><b style={{ width: `${Math.round((s.c / s.t) * 100)}%` }} /></div>
                <span className="muted w-14 text-right">{Math.round((s.c / s.t) * 100)} %</span>
              </div>
            ))}
            <p className="muted text-[11px] mt-1">{lessonsDone ?? 0} lektioner klara</p>
          </div>
        </div>

        <div className="sec">
          <div className="sec-title">Utmärkelser · {earned.size}/{ach?.length ?? 0}</div>
          <div className="grid grid-cols-4 gap-2 mt-3">
            {(ach ?? []).map((a) => (
              <div key={a.id} className={`card !p-2 text-center ${earned.has(a.id) ? "" : "opacity-40 grayscale"}`} title={a.description}>
                <div className="text-2xl">{a.icon}</div>
                <div className="text-[10px] font-bold mt-1 leading-tight">{a.name}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="sec">
          <div className="sec-title">Historik</div>
          <div className="card mt-3 !py-2">
            {(sessions ?? []).length === 0 && <p className="muted text-[13px] py-3">Inga rundor än.</p>}
            {(sessions ?? []).map((s) => (
              <Link key={s.id} href={`/play/${s.id}`} className="rank-row">
                <span className="text-lg">{s.status === "bust" ? "💥" : "🏁"}</span>
                <div className="flex-1"><b className="text-[13px]">{MODE_LABEL[s.mode]}</b><p className="muted text-[11px]">{new Date(s.created_at).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" })}</p></div>
                <span className="text-[12px]">{s.correct}/{s.total}</span>
                <span className="pill e">+{s.xp_awarded}</span>
              </Link>
            ))}
          </div>
        </div>
        <form action="/api/auth/signout" method="post" className="mt-8"><button className="btn-ghost w-full">Logga ut</button></form>
      </div>
    </>
  );
}
