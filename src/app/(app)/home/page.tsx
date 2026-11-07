import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { Header } from "@/components/TopBar";
import { Avatar } from "@/components/Avatar";
import { recommend } from "@/lib/engine";
import { getActiveDays, getClassMatch, getContinueLearning, getDailyStatus, getStreak, getSubjects } from "@/lib/data";
import { DIFF_LABEL, levelProgress, todayKey } from "@/lib/xp";
import { dailyPlan } from "@/lib/engine";
import { admin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const GAMES = [
  { href: "/games/blackjack", icon: "🃏", name: "KNOWLEDGE BLACKJACK", sub: "Nå 21 med rätt svar", g: "linear-gradient(160deg,#0f3b2a,#071a12)" },
  { href: "/games/wheel", icon: "🎡", name: "KNOWLEDGE WHEEL", sub: "Snurra fram ett ämne", g: "linear-gradient(160deg,#3b2a6b,#160f2e)" },
  { href: "/games/slots", icon: "🎰", name: "KNOWLEDGE SLOTS", sub: "Ämne · Nivå · Typ", g: "linear-gradient(160deg,#5a3a0a,#1f1403)" },
  { href: "/games/brainrush", icon: "⚡", name: "BRAIN RUSH", sub: "60 sekunder", g: "linear-gradient(160deg,#1e3a8a,#0b1540)" },
  { href: "/games/highstakes", icon: "💎", name: "HIGH STAKES QUIZ", sub: "Stigande insats", g: "linear-gradient(160deg,#6b1d2a,#2a0a10)" },
];

export default async function Home() {
  const { profile } = await requireProfile();
  const p = profile;
  const [rec, streak, days, daily, cont, match, plan, school, cls, subjects] = await Promise.all([
    recommend(p.id),
    getStreak(p.id),
    getActiveDays(p.id),
    getDailyStatus(p.id),
    getContinueLearning(p.id),
    getClassMatch(p.class_id),
    dailyPlan(todayKey()),
    p.school_id ? admin().from("schools").select("name").eq("id", p.school_id).maybeSingle() : Promise.resolve({ data: null }),
    p.class_id ? admin().from("classes").select("label").eq("id", p.class_id).maybeSingle() : Promise.resolve({ data: null }),
    getSubjects(),
  ]);
  const lp = levelProgress(p.xp);
  const recSubject = subjects.find((s) => s.id === rec.subjectId);
  const formatLabel = rec.formats ? "Flerval" : "Blandat format";

  return (
    <>
      <Header coins={p.coins} xp={p.xp} />
      <div className="page">
        <div className="flex items-center gap-3.5 mt-3">
          <Avatar emoji={p.avatar} pct={lp.pct} />
          <div>
            <h1 className="text-[18px] font-extrabold">{p.alias}</h1>
            <p className="muted text-[12px] mt-0.5">{school.data?.name ? `${school.data.name}${cls.data?.label ? ` · ${cls.data.label}` : ""}` : "Ingen klass ännu"}</p>
          </div>
          <div className="ml-auto text-right">
            <b className="block serif text-[11px] tracking-[.14em] text-gold uppercase">{lp.rank}</b>
            <span className="muted text-[11px]">Nivå {lp.level}</span>
          </div>
        </div>
        <div className="xpbar mt-3"><b style={{ width: `${lp.pct}%` }} /></div>
        <div className="flex justify-between muted text-[11px] mt-1.5"><span>Nivå {lp.level}</span><span>{lp.toNext} XP kvar till nivå {lp.level + 1}</span></div>

        <Link href={`/games/quick?subject=${rec.subjectId}&difficulty=${rec.difficulty}`} className="play-cta mt-5">
          <div>
            <h2>PLAY</h2>
            <p className="mt-1.5 text-[12px] text-[#bfe6d3]">
              Rekommenderat: {recSubject?.icon} {rec.subjectName} · {DIFF_LABEL[rec.difficulty]} · {formatLabel}
            </p>
            <p className="text-[11px] text-[#bfe6d3]/70 mt-0.5">{rec.reason}</p>
            <span className="btn-gold mt-3.5">▶ STARTA SPEL</span>
          </div>
        </Link>
        {rec.formatReason && (
          <div className="card purple mt-3 text-[12px]">
            <span className="pill p mb-1.5">AI-INSIKT</span>
            <p className="mt-1">{rec.formatReason}</p>
            <Link href="/profile/settings" className="gold font-bold text-[12px] block mt-1.5">Byt svarsformat →</Link>
          </div>
        )}

        <div className="sec">
          <div className="card flex items-center gap-3.5">
            <div className="flame">🔥</div>
            <div>
              <b className="text-[16px]">{streak === 0 ? "Ingen streak än" : `${streak} ${streak === 1 ? "dag" : "dagar"} i rad`}</b>
              <p className="muted text-[12px]">Ingen stress – streaken är bara en bonus.</p>
            </div>
            <div className="dots ml-auto">{days.map((on, i) => <i key={i} className={on ? "on" : ""} />)}</div>
          </div>
        </div>

        <div className="sec">
          <div className="sec-title">Dagens utmaning</div>
          <Link href="/games/daily" className="card purple interactive mt-3">
            {!daily && <span className="ribbon">NY</span>}
            <div className="text-[10px] tracking-[.2em] font-extrabold text-[#c4b5fd]">{plan.subject.name.toUpperCase()} · BLANDAD NIVÅ</div>
            <h4 className="mt-1.5 text-[16px] font-bold">{plan.questions.length} frågor – samma för alla idag</h4>
            <p className="muted text-[12px] mt-1">
              {daily ? (daily.status === "active" ? "Du har en påbörjad runda – fortsätt!" : `Klart: ${daily.correct}/${daily.total} rätt · +${daily.xp_awarded} XP`) : "Resultatet räknas till klassen. En chans per dag."}
            </p>
            <div className="flex gap-2 mt-3"><span className="pill g">+100 XP bonus vid ≥70 %</span><span className="pill">⏱ ca 5 min</span></div>
          </Link>
        </div>

        <div className="sec">
          <div className="sec-title">Spel <Link href="/games">Visa alla</Link></div>
          <div className="hrow">
            {GAMES.map((g) => (
              <Link key={g.href} href={g.href} className="gcard" style={{ ["--g" as string]: g.g }}>
                <span className="ic">{g.icon}</span>
                <b>{g.name}</b>
                <small>{g.sub}</small>
              </Link>
            ))}
          </div>
        </div>

        <div className="sec">
          <div className="sec-title">Fortsätt lära</div>
          {cont ? (
            <Link href={`/learn/lesson/${cont.lessonId}`} className="card interactive mt-3 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl grid place-items-center text-xl bg-gradient-to-br from-blue to-[#1e3a8a]">{cont.subjectIcon}</div>
              <div className="flex-1 min-w-0">
                <b className="block text-[14px] truncate">{cont.subjectName} · {cont.chapterTitle}</b>
                <p className="muted text-[12px] truncate">Nästa: {cont.lessonTitle} · {cont.completed} av {cont.total} klara</p>
              </div>
              <div className="ring" style={{ ["--pct" as string]: `${cont.pct}%` }}><i>{cont.pct}%</i></div>
            </Link>
          ) : (
            <Link href="/learn" className="card interactive mt-3 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl grid place-items-center text-xl bg-gradient-to-br from-blue to-[#1e3a8a]">📚</div>
              <div><b className="block text-[14px]">Alla lektioner klara!</b><p className="muted text-[12px]">Utforska biblioteket eller ladda upp eget material.</p></div>
            </Link>
          )}
        </div>

        <div className="sec">
          <div className="sec-title">Klassmatch · vecka {isoWeek()}</div>
          {match ? (
            <Link href="/rankings" className="card interactive mt-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 text-center">
                  <b className="block text-[14px]">{match.mine.label}</b>
                  <span className="muted text-[11px]">{match.mine.school}</span>
                  <div className="text-[22px] font-extrabold emerald">{match.mine.score}</div>
                </div>
                <div className="serif font-extrabold text-gold text-[12px]">VS</div>
                <div className="flex-1 text-center">
                  <b className="block text-[14px]">{match.rival ? match.rival.label : "—"}</b>
                  <span className="muted text-[11px]">{match.rival ? match.rival.school : "Ingen motståndare än"}</span>
                  <div className="text-[22px] font-extrabold text-muted">{match.rival ? match.rival.score : 0}</div>
                </div>
              </div>
              <p className="muted text-[11px] mt-2 text-center">
                {match.mine.rank ? `Plats ${match.mine.rank} av ${match.totalClasses} · ` : ""}{match.mine.active_members}/{match.mine.total_members} aktiva · normaliserad poäng
              </p>
            </Link>
          ) : (
            <Link href="/schools" className="card interactive mt-3 text-center">
              <b className="text-[14px]">Gå med i din klass</b>
              <p className="muted text-[12px] mt-1">Då syns klassmatchen här och dina XP räknas till laget.</p>
            </Link>
          )}
        </div>
      </div>
    </>
  );
}

function isoWeek(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
