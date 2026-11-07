import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { requireProfile } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { getSubjects } from "@/lib/data";
import { weekRange } from "@/lib/xp";

export const metadata = { title: "Topplista" };
export const dynamic = "force-dynamic";

const TABS = [["classes", "Klasser"], ["schools", "Skolor"], ["subjects", "Ämnen"], ["students", "Elever"]] as const;

export default async function Rankings({ searchParams }: { searchParams: Promise<{ tab?: string; subject?: string }> }) {
  const sp = await searchParams;
  const tab = (TABS.find((t) => t[0] === sp.tab)?.[0] ?? "classes") as (typeof TABS)[number][0];
  const { profile } = await requireProfile();
  const p = profile;
  const db = admin();
  const { from, to } = weekRange();
  const subjects = await getSubjects();
  const subject = subjects.find((s) => s.id === sp.subject)?.id ?? subjects[0]?.id;

  let rows: { id: string; title: string; sub: string; score: string; me: boolean; icon?: string }[] = [];
  if (tab === "classes") {
    const { data } = await db.rpc("class_week_scores", { p_from: from, p_to: to });
    const list = ((data ?? []) as { class_id: string; score: number; active_members: number; total_members: number }[]).sort((a, b) => b.score - a.score).slice(0, 50);
    const { data: classes } = list.length ? await db.from("classes").select("id,label,year,schools(name,city)").in("id", list.map((l) => l.class_id)) : { data: [] };
    rows = list.map((l) => {
      const c = classes?.find((x) => x.id === l.class_id);
      const s = c?.schools as unknown as { name: string; city: string } | null;
      return { id: l.class_id, title: `${c?.label ?? "?"} · ${s?.name ?? ""}`, sub: `${s?.city ?? ""} · ${l.active_members}/${l.total_members} aktiva`, score: String(l.score), me: l.class_id === p.class_id };
    });
  } else if (tab === "schools") {
    const { data } = await db.rpc("school_week_scores", { p_from: from, p_to: to });
    const list = ((data ?? []) as { school_id: string; score: number; active_classes: number }[]).sort((a, b) => b.score - a.score).slice(0, 50);
    const { data: schools } = list.length ? await db.from("schools").select("id,name,city,verified").in("id", list.map((l) => l.school_id)) : { data: [] };
    rows = list.map((l) => {
      const s = schools?.find((x) => x.id === l.school_id);
      return { id: l.school_id, title: `${s?.name ?? "?"}${s?.verified ? " ✅" : ""}`, sub: `${s?.city ?? ""} · ${l.active_classes} aktiva klasser`, score: String(l.score), me: l.school_id === p.school_id };
    });
  } else if (tab === "subjects") {
    const { data } = await db.rpc("subject_school_scores", { p_subject: subject, p_from: from, p_to: to });
    const list = ((data ?? []) as { school_id: string; score: number; students: number }[]).sort((a, b) => b.score - a.score).slice(0, 50);
    const { data: schools } = list.length ? await db.from("schools").select("id,name,city").in("id", list.map((l) => l.school_id)) : { data: [] };
    rows = list.map((l) => {
      const s = schools?.find((x) => x.id === l.school_id);
      return { id: l.school_id, title: s?.name ?? "?", sub: `${s?.city ?? ""} · ${l.students} elever`, score: String(l.score), me: l.school_id === p.school_id };
    });
  } else {
    const { data } = await db.rpc("national_students", { p_from: from, p_to: to, p_limit: 50 });
    rows = ((data ?? []) as { user_id: string; alias: string; avatar: string; xp: number; school_name: string | null; class_label: string | null }[]).map((r) => ({
      id: r.user_id, icon: r.avatar, title: r.alias, sub: r.school_name ? `${r.school_name}${r.class_label ? " · " + r.class_label : ""}` : "Skola dold", score: `${r.xp} XP`, me: r.user_id === p.id,
    }));
  }

  return (
    <>
      <TopBar title="Topplista" />
      <div className="page">
        <div className="seg">
          {TABS.map(([k, l]) => <Link key={k} href={`/rankings?tab=${k}`} className={`flex-1 text-center py-2 rounded-[9px] text-[12px] font-bold ${tab === k ? "bg-gold/15 text-gold" : "text-muted"}`}>{l}</Link>)}
        </div>
        {tab === "subjects" && (
          <div className="hrow !mt-3">
            {subjects.map((s) => <Link key={s.id} href={`/rankings?tab=subjects&subject=${s.id}`} className={`pill ${s.id === subject ? "g" : ""}`}>{s.icon} {s.name}</Link>)}
          </div>
        )}
        <p className="muted text-[11px] mt-3">Vecka {new Date(from).toLocaleDateString("sv-SE")} – {new Date(new Date(to).getTime() - 1).toLocaleDateString("sv-SE")}. {tab === "students" ? "Bara elever med offentlig profil visas." : "Normaliserad poäng: snitt per aktiv deltagare med XP-tak och deltagandefaktor – storlek vinner inte automatiskt."}</p>
        <div className="card mt-3 !py-2">
          {rows.length === 0 && <p className="muted text-[13px] py-4 text-center">Ingen aktivitet än den här veckan. Spela en runda så hamnar {tab === "students" ? "du" : "din klass"} här!</p>}
          {rows.map((r, i) => (
            <div key={r.id} className={`rank-row ${r.me ? "me" : ""}`}>
              <span className={`pos ${i < 3 ? `top${i + 1}` : ""}`}>{i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</span>
              {r.icon && <span className="text-xl">{r.icon}</span>}
              <div className="flex-1 min-w-0"><b className="block text-[14px] truncate">{r.title}</b><span className="muted text-[11px]">{r.sub}</span></div>
              <span className="pill g">{r.score}</span>
            </div>
          ))}
        </div>
        {!p.class_id && <Link href="/schools" className="btn-gold w-full mt-4">Gå med i din klass</Link>}
      </div>
    </>
  );
}
