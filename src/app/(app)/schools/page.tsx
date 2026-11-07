import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { SchoolsClient } from "@/components/SchoolsClient";
import { requireProfile } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { weekRange } from "@/lib/xp";

export const metadata = { title: "Skolor" };
export const dynamic = "force-dynamic";

export default async function Schools() {
  const { profile } = await requireProfile();
  const p = profile;
  const db = admin();
  if (!p.class_id) {
    return (
      <>
        <TopBar title="Skolor" />
        <div className="page">
          <div className="card felt mb-4">
            <b className="text-[15px]">Du är inte med i någon klass</b>
            <p className="text-[13px] mt-1 text-[#bfe6d3]">Gå med för att tävla i klass- och skoltävlingar. Alla visas med alias – aldrig riktiga namn.</p>
          </div>
          <SchoolsClient mode="join" />
        </div>
      </>
    );
  }
  const { from, to } = weekRange();
  const [{ data: cls }, { data: members }, { data: classScores }, { data: schoolScores }, { data: sameSchool }] = await Promise.all([
    db.from("classes").select("id,label,year,join_code,verified,created_by,school_id,schools(id,name,city,verified)").eq("id", p.class_id).single(),
    db.rpc("class_member_week", { p_class: p.class_id, p_from: from, p_to: to }),
    db.rpc("class_week_scores", { p_from: from, p_to: to }),
    db.rpc("school_week_scores", { p_from: from, p_to: to }),
    db.from("classes").select("id,label,year").eq("school_id", p.school_id!).order("year").order("label"),
  ]);
  const school = cls?.schools as unknown as { id: string; name: string; city: string; verified: boolean };
  const scores = ((classScores ?? []) as { class_id: string; score: number; active_members: number; total_members: number }[]).sort((a, b) => b.score - a.score);
  const myRank = scores.findIndex((s) => s.class_id === p.class_id) + 1;
  const mine = scores.find((s) => s.class_id === p.class_id);
  const ss = ((schoolScores ?? []) as { school_id: string; score: number; active_classes: number }[]).sort((a, b) => b.score - a.score);
  const schoolRank = ss.findIndex((s) => s.school_id === p.school_id) + 1;
  const canManage = p.role === "admin" || cls?.created_by === p.id;
  const mem = (members ?? []) as { user_id: string; alias: string; avatar: string; xp: number; is_public: boolean }[];
  return (
    <>
      <TopBar title="Skolor" />
      <div className="page">
        <div className="card felt">
          <div className="serif text-[11px] tracking-[.14em] text-gold">MIN KLASS</div>
          <h2 className="text-[22px] font-extrabold mt-1">{cls?.label} · {school.name}</h2>
          <p className="muted text-[12px]">{school.city} · {cls && cls.year <= 9 ? `Årskurs ${cls.year}` : `Gymnasiet år ${(cls?.year ?? 10) - 9}`} · {school.verified ? "✅ verifierad skola" : "ej verifierad"}</p>
          <div className="grid2 mt-4">
            <div className="stat"><b className="gold">{myRank || "–"}</b><span>plats av {scores.length} klasser i veckan</span></div>
            <div className="stat"><b>{mine?.score ?? 0}</b><span>klasspoäng · {mine?.active_members ?? 0}/{mine?.total_members ?? mem.length} aktiva</span></div>
          </div>
        </div>

        <SchoolsClient mode="manage" joinCode={cls?.join_code?.startsWith("X-") ? null : cls?.join_code ?? null} canManage={canManage} schoolId={school.id} classId={p.class_id} />

        <div className="sec">
          <div className="sec-title">Klassen denna vecka</div>
          <div className="card mt-3 !py-2">
            {mem.map((m, i) => (
              <div key={m.user_id} className={`rank-row ${m.user_id === p.id ? "me" : ""}`}>
                <span className={`pos ${i < 3 ? `top${i + 1}` : ""}`}>{i + 1}</span>
                <span className="text-xl">{m.is_public || m.user_id === p.id ? m.avatar : "👤"}</span>
                <b className="flex-1 text-[14px]">{m.is_public || m.user_id === p.id ? m.alias : "Privat elev"}</b>
                <span className="pill e">{Math.min(m.xp, 1500)} XP{m.xp > 1500 ? " (tak)" : ""}</span>
              </div>
            ))}
          </div>
          <p className="muted text-[11px] mt-2">Varje elev kan max bidra med 1 500 XP/vecka till klasspoängen, som är ett snitt över aktiva elever × deltagandefaktor. Så kan inte en enda elev bära laget.</p>
        </div>

        <div className="sec">
          <div className="sec-title">Skolan <Link href="/rankings?tab=schools">Topplista</Link></div>
          <div className="card mt-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🏫</span>
              <div className="flex-1"><b className="text-[14px]">{school.name}</b><p className="muted text-[12px]">{sameSchool?.length ?? 0} klasser · {schoolRank ? `plats ${schoolRank} av ${ss.length}` : "ingen aktivitet än"} denna vecka</p></div>
            </div>
            <div className="flex gap-2 flex-wrap mt-3">
              {(sameSchool ?? []).map((c) => <span key={c.id} className={`pill ${c.id === p.class_id ? "g" : ""}`}>{c.label}</span>)}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
