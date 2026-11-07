"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type School = { id: string; name: string; city: string; verified: boolean; classes?: number };
type Cls = { id: string; year: number; label: string; verified: boolean; members: number };

const YEARS = [
  { v: 7, l: "Åk 7" }, { v: 8, l: "Åk 8" }, { v: 9, l: "Åk 9" },
  { v: 10, l: "Gy 1" }, { v: 11, l: "Gy 2" }, { v: 12, l: "Gy 3" },
];

export function SchoolPicker({ onDone }: { onDone: (info: { school: string; label: string }) => void }) {
  const [tab, setTab] = useState<"code" | "search">("code");
  const [code, setCode] = useState("");
  const [q, setQ] = useState("");
  const [schools, setSchools] = useState<School[]>([]);
  const [school, setSchool] = useState<School | null>(null);
  const [classes, setClasses] = useState<Cls[] | null>(null);
  const [newSchool, setNewSchool] = useState({ name: "", city: "" });
  const [newClass, setNewClass] = useState({ year: 8, label: "" });
  const [creatingSchool, setCreatingSchool] = useState(false);
  const [creatingClass, setCreatingClass] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) return setSchools([]);
    const t = setTimeout(async () => {
      const r = await fetch(`/api/schools/search?q=${encodeURIComponent(q)}`).then((r) => r.json());
      setSchools(r.schools ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  async function pickSchool(s: School) {
    setSchool(s);
    setClasses(null);
    const r = await fetch(`/api/schools/${s.id}/classes`).then((r) => r.json());
    setClasses(r.classes ?? []);
  }

  async function run(fn: () => Promise<void>) {
    setErr(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="seg">
        <button type="button" className={tab === "code" ? "on" : ""} onClick={() => setTab("code")}>Jag har en klasskod</button>
        <button type="button" className={tab === "search" ? "on" : ""} onClick={() => setTab("search")}>Sök skola</button>
      </div>

      {tab === "code" && (
        <div className="card grid gap-3">
          <label className="lbl">Klasskod (6 tecken)</label>
          <input className="input tracking-[.3em] uppercase text-center text-[20px] font-extrabold" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABC123" />
          <button className="btn-gold" disabled={busy || code.length < 6} onClick={() => run(async () => {
            const r = await api<{ class: { label: string; school: string } }>("/api/classes/join", { code });
            onDone({ school: r.class.school, label: r.class.label });
          })}>GÅ MED</button>
          <p className="muted text-[12px]">Koden får du av en klasskompis eller lärare. Ingen i klassen ser ditt riktiga namn – bara ditt alias.</p>
        </div>
      )}

      {tab === "search" && !school && (
        <div className="card grid gap-3">
          <label className="lbl">Skolans namn eller ort</label>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="t.ex. Björkskataskolan" autoFocus />
          {schools.map((s) => (
            <button key={s.id} type="button" className="opt" onClick={() => pickSchool(s)}>
              <span className="k">🏫</span>
              <span className="flex-1">
                <span className="block">{s.name}</span>
                <span className="muted text-[12px] font-medium">{s.city} · {s.classes ?? 0} klasser {s.verified ? "· ✅ verifierad" : "· ej verifierad"}</span>
              </span>
            </button>
          ))}
          {q.trim().length >= 2 && !creatingSchool && (
            <button type="button" className="btn-ghost" onClick={() => { setCreatingSchool(true); setNewSchool({ name: q, city: "" }); }}>
              Hittar inte skolan? Lägg till den
            </button>
          )}
          {creatingSchool && (
            <div className="grid gap-2 border-t border-[var(--line)] pt-3">
              <input className="input" placeholder="Skolans namn" value={newSchool.name} onChange={(e) => setNewSchool({ ...newSchool, name: e.target.value })} />
              <input className="input" placeholder="Ort" value={newSchool.city} onChange={(e) => setNewSchool({ ...newSchool, city: e.target.value })} />
              <button className="btn-gold" disabled={busy} onClick={() => run(async () => {
                const r = await api<{ school: School; existed: boolean }>("/api/schools", newSchool);
                setCreatingSchool(false);
                pickSchool(r.school);
              })}>SKAPA SKOLA</button>
              <p className="muted text-[11px]">Nya skolor markeras som ”ej verifierade” tills en admin granskat dem. Dubbletter kan rapporteras och slås ihop.</p>
            </div>
          )}
        </div>
      )}

      {tab === "search" && school && (
        <div className="card grid gap-3">
          <div className="flex items-center gap-2">
            <button type="button" className="back" onClick={() => setSchool(null)}>‹</button>
            <div>
              <b className="block text-[14px]">{school.name}</b>
              <span className="muted text-[12px]">{school.city}</span>
            </div>
          </div>
          {classes === null && <div className="spinner" />}
          {classes?.map((c) => (
            <button key={c.id} type="button" className="opt" disabled={busy} onClick={() => run(async () => {
              await api("/api/classes/join", { class_id: c.id });
              onDone({ school: school.name, label: c.label });
            })}>
              <span className="k">{c.year}</span>
              <span className="flex-1">
                <span className="block">Klass {c.label}</span>
                <span className="muted text-[12px] font-medium">{c.members} elever {c.verified ? "· ✅" : ""}</span>
              </span>
            </button>
          ))}
          {classes && classes.length === 0 && <p className="muted text-[13px]">Inga klasser ännu – skapa den första.</p>}
          {!creatingClass ? (
            <button type="button" className="btn-ghost" onClick={() => setCreatingClass(true)}>+ Skapa ny klass</button>
          ) : (
            <div className="grid gap-2 border-t border-[var(--line)] pt-3">
              <div className="seg flex-wrap">
                {YEARS.map((y) => (
                  <button key={y.v} type="button" className={newClass.year === y.v ? "on" : ""} onClick={() => setNewClass({ ...newClass, year: y.v })}>{y.l}</button>
                ))}
              </div>
              <input className="input" placeholder="Klassbeteckning, t.ex. 8B eller NA2" value={newClass.label} onChange={(e) => setNewClass({ ...newClass, label: e.target.value })} />
              <button className="btn-gold" disabled={busy || !newClass.label} onClick={() => run(async () => {
                await api("/api/classes", { school_id: school.id, ...newClass });
                onDone({ school: school.name, label: newClass.label.toUpperCase() });
              })}>SKAPA & GÅ MED</button>
            </div>
          )}
        </div>
      )}
      {err && <p className="danger text-[13px]">{err}</p>}
    </div>
  );
}
