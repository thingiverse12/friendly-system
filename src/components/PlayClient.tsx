"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useFx } from "./Fx";
import { DIFF_LABEL, MODE_LABEL, QTYPE_LABEL } from "@/lib/xp";
import type { AnswerResult, PublicQuestion, SessionView } from "@/lib/types";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export function PlayClient({ id }: { id: string }) {
  const router = useRouter();
  const fx = useFx();
  const [s, setS] = useState<SessionView | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [intro, setIntro] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const v = await api<SessionView>(`/api/game/${id}`, undefined, "GET");
      setS(v);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Brain Rush timer
  useEffect(() => {
    if (s?.mode !== "brainrush" || s.status !== "active") return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [s?.mode, s?.status]);
  const deadline = s?.public_meta?.deadline ? new Date(s.public_meta.deadline as string).getTime() : null;
  const secondsLeft = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null;
  useEffect(() => {
    if (s?.mode === "brainrush" && s.status === "active" && secondsLeft === 0) {
      const t = setTimeout(load, 1200);
      return () => clearTimeout(t);
    }
  }, [secondsLeft, s?.mode, s?.status, load]);

  async function submit(response: unknown) {
    if (!s?.current || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api<AnswerResult>(`/api/game/${id}/answer`, { idx: s.current.idx, response });
      fx.play(r.correct ? "correct" : "wrong");
      if (r.level_up || r.blackjack?.blackjack) setTimeout(() => fx.play("win"), 300);
      setAiText(null);
      if (s.mode === "brainrush") {
        setS(r.session);
        setResult(r.finished ? r : null);
        if (!r.correct) setFlash(r.correct_answer);
      } else {
        setResult(r);
        setS(r.session);
      }
    } catch (e) {
      setErr((e as Error).message);
      await load();
    } finally {
      setBusy(false);
    }
  }
  const [flash, setFlashState] = useState<string | null>(null);
  function setFlash(v: string | null) {
    setFlashState(v);
    setTimeout(() => setFlashState(null), 900);
  }

  async function next() {
    fx.play("click");
    setResult(null);
    setAiText(null);
    await load();
  }

  async function stand() {
    setBusy(true);
    try {
      const v = await api<SessionView>(`/api/game/${id}/stand`);
      fx.play("coin");
      setS(v);
      setResult(null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function abandon() {
    if (!confirm("Avsluta rundan nu? XP du redan fått behåller du.")) return;
    const v = await api<SessionView>(`/api/game/${id}/abandon`);
    setS(v);
    setResult(null);
  }

  async function askAi(q: PublicQuestion | null, r: AnswerResult | null) {
    if (!q) return;
    setAiBusy(true);
    try {
      const res = await api<{ text: string; offline: boolean }>("/api/ai/teacher", {
        prompt: q.prompt, subject: q.subject_id, your_answer: r ? (r.correct ? "rätt" : "fel") : null, correct_answer: r?.correct_answer ?? null, explanation: r?.explanation ?? null, mode: r ? "after" : "hint",
      });
      setAiText(res.text);
    } catch (e) {
      setAiText((e as Error).message);
    } finally {
      setAiBusy(false);
    }
  }

  if (err && !s) return <div className="page pt-10"><div className="card danger">{err}</div><Link href="/games" className="btn-ghost mt-4">Till spel</Link></div>;
  if (!s) return <div className="page pt-10 grid gap-3"><div className="skeleton h-10" /><div className="skeleton h-40" /><div className="skeleton h-14" /><div className="skeleton h-14" /></div>;

  if (intro && s.status === "active" && s.answered === 0 && (s.mode === "wheel" || s.mode === "slots")) {
    return s.mode === "wheel" ? <WheelIntro s={s} onDone={() => setIntro(false)} /> : <SlotsIntro s={s} onDone={() => setIntro(false)} />;
  }

  if (s.status !== "active") return <Summary s={s} onReplay={() => router.push(`/games/${s.mode === "daily" ? "" : s.mode}`)} askAi={askAi} aiText={aiText} aiBusy={aiBusy} />;

  const q = s.current!;
  const pct = Math.round((s.answered / s.total) * 100);
  const hand = (s.public_meta.hand as number[] | undefined) ?? [];
  const handTotal = (s.public_meta.hand_total as number | undefined) ?? 0;

  return (
    <div className="page pb-8">
      <div className="flex items-center gap-3 pt-4">
        <button className="back" onClick={abandon} aria-label="Avsluta">✕</button>
        <div className="flex-1 min-w-0">
          <div className="serif text-[11px] tracking-[.14em] text-gold uppercase truncate">{MODE_LABEL[s.mode]}{s.public_meta.subject_name ? ` · ${s.public_meta.subject_name as string}` : ""}</div>
          <div className="xpbar mt-1.5"><b style={{ width: `${pct}%` }} /></div>
        </div>
        <div className="text-right">
          {s.mode === "brainrush" ? (
            <b className={`kpi ${secondsLeft !== null && secondsLeft <= 10 ? "danger" : ""}`}>{secondsLeft}s</b>
          ) : (
            <span className="muted text-[12px]">{s.answered + 1}/{s.total}</span>
          )}
        </div>
      </div>

      <div className="flex gap-2 mt-3 flex-wrap">
        <span className="pill g">{DIFF_LABEL[q.difficulty]}</span>
        <span className="pill">{QTYPE_LABEL[q.qtype]}</span>
        {q.source === "ai" && <span className="pill p">AI-genererad · ej verifierad</span>}
        {s.mode === "highstakes" && <span className="pill r">Insats ×{q.idx + 1}</span>}
        {s.competitive && <span className="pill b">Tävling</span>}
        <span className="pill e ml-auto">+{s.xp_awarded} XP</span>
      </div>

      {s.mode === "blackjack" && (
        <div className="card felt mt-3">
          <div className="flex items-center justify-between">
            <span className="serif text-[11px] tracking-[.14em] text-gold">DIN HAND</span>
            <b className={`text-[20px] ${handTotal === 21 ? "gold" : handTotal > 21 ? "danger" : ""}`}>{handTotal}</b>
          </div>
          <div className="flex gap-2 mt-2 flex-wrap min-h-[64px]">
            {hand.length === 0 && <div className="playing-card back" />}
            {hand.map((c, i) => <div key={i} className={`playing-card pop ${i % 2 ? "red" : ""}`}>{c === 11 ? "A" : c}</div>)}
          </div>
          <p className="muted text-[11px] mt-2">Rätt svar = nytt kort. Stanna när du vill: bonus = summan × 3 XP. Exakt 21 ger +75 XP. Över 21 = bust (du behåller intjänad XP).</p>
        </div>
      )}
      {s.mode === "brainrush" && flash && <div className="card mt-3 shake danger text-[13px]">Rätt svar: {flash}</div>}

      <div className={`card mt-3 ${result ? (result.correct ? "" : "shake") : "fade-up"}`} key={q.idx}>
        <p className="text-[17px] font-bold leading-snug">{q.prompt}</p>
        <div className="mt-4 grid gap-2">
          <QuestionInput q={q} disabled={!!result || busy} onSubmit={submit} result={result} autoFocus={s.mode === "brainrush"} />
        </div>
      </div>

      {result && (
        <div className={`card mt-3 pop ${result.correct ? "border-emerald/40" : "border-red-500/40"}`}>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{result.correct ? "✅" : "❌"}</span>
            <div className="flex-1">
              <b className="text-[16px]">{result.correct ? "Rätt!" : "Inte riktigt"}</b>
              <p className="muted text-[12px]">
                {result.correct ? `+${result.xp} XP · +${result.coins} mynt` : result.correct_answer ? `Rätt svar: ${result.correct_answer}` : "Facit visas efter rundan"}
                {result.flags.includes("repeat_reduced") && " · lägre XP för repetition"}
                {result.flags.includes("repeat_no_xp") && " · du kan redan den här (0 XP)"}
                {result.flags.includes("fast_answer") && " · väldigt snabbt svar – XP halverad"}
              </p>
            </div>
            {result.blackjack?.card && <div className="playing-card pop red">{result.blackjack.card === 11 ? "A" : result.blackjack.card}</div>}
          </div>
          {result.explanation && <p className="text-[13px] mt-3 border-t border-white/10 pt-3">{result.explanation}</p>}
          {result.level_up && <div className="pill g mt-3">🎉 Nivå {result.level_up}!</div>}
          {result.achievements?.map((a) => <div key={a.id} className="pill p mt-2 ml-1">{a.icon} {a.name}</div>)}
          {!s.competitive && (
            <div className="mt-3">
              {aiText ? (
                <div className="text-[13px] bg-white/5 rounded-xl p-3 border border-purple/30"><span className="pill p mb-1">AI-LÄRARE</span><p className="mt-1 whitespace-pre-wrap">{aiText}</p></div>
              ) : (
                <button className="btn-ghost text-[12px]" disabled={aiBusy} onClick={() => askAi(q, result)}>{aiBusy ? "Tänker…" : "🧠 Förklara mer (AI-lärare)"}</button>
              )}
            </div>
          )}
          <div className="flex gap-2 mt-4">
            {s.mode === "blackjack" && result.correct && !result.finished ? (
              <>
                <button className="btn-gold flex-1" onClick={next} disabled={busy}>KORT TILL</button>
                <button className="btn-ghost flex-1" onClick={stand} disabled={busy}>STANNA ({result.blackjack?.total})</button>
              </>
            ) : (
              <button className="btn-gold flex-1" onClick={next} disabled={busy}>{result.finished ? "SE RESULTAT" : "NÄSTA"}</button>
            )}
          </div>
        </div>
      )}
      {!result && s.mode === "blackjack" && hand.length > 0 && (
        <button className="btn-ghost w-full mt-3" onClick={stand} disabled={busy}>Stanna på {handTotal}</button>
      )}
      {err && <p className="danger text-[13px] mt-3">{err}</p>}
    </div>
  );
}

function QuestionInput({ q, disabled, onSubmit, result, autoFocus }: { q: PublicQuestion; disabled: boolean; onSubmit: (r: unknown) => void; result: AnswerResult | null; autoFocus?: boolean }) {
  const [text, setText] = useState("");
  const [sel, setSel] = useState<number | null>(null);
  const [matches, setMatches] = useState<(number | null)[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setText("");
    setSel(null);
    setMatches(q.qtype === "match" ? ((q.options as { left: string[] }).left ?? []).map(() => null) : []);
    if (autoFocus) setTimeout(() => inputRef.current?.focus(), 50);
  }, [q.idx, q.qtype, q.options, autoFocus]);

  if (q.qtype === "mcq") {
    const opts = q.options as string[];
    return (
      <>
        {opts.map((o, i) => {
          let cls = "opt";
          if (result && sel === i) cls += result.correct ? " ok" : " bad";
          else if (result && result.correct_answer === o) cls += " ok";
          else if (sel === i) cls += " sel";
          return (
            <button key={i} className={cls} disabled={disabled} onClick={() => { setSel(i); onSubmit(i); }}>
              <span className="k">{LETTERS[i]}</span>
              <span>{o}</span>
            </button>
          );
        })}
      </>
    );
  }
  if (q.qtype === "tf") {
    return (
      <div className="grid grid-cols-2 gap-2">
        {[true, false].map((v) => {
          let cls = "opt justify-center";
          if (result && sel === (v ? 1 : 0)) cls += result.correct ? " ok" : " bad";
          return (
            <button key={String(v)} className={cls} disabled={disabled} onClick={() => { setSel(v ? 1 : 0); onSubmit(v); }}>
              {v ? "✔ Sant" : "✖ Falskt"}
            </button>
          );
        })}
      </div>
    );
  }
  if (q.qtype === "match") {
    const o = q.options as { left: string[]; right: string[] };
    const ready = matches.every((m) => m !== null);
    return (
      <>
        {o.left.map((l, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="flex-1 text-[14px] font-semibold">{l}</span>
            <span className="muted">→</span>
            <select className="input flex-1 !py-2" disabled={disabled} value={matches[i] ?? ""} onChange={(e) => { const m = [...matches]; m[i] = e.target.value === "" ? null : Number(e.target.value); setMatches(m); }}>
              <option value="">Välj…</option>
              {o.right.map((r, j) => <option key={j} value={j}>{r}</option>)}
            </select>
          </div>
        ))}
        {!result && <button className="btn-gold mt-2" disabled={disabled || !ready} onClick={() => onSubmit(matches)}>SVARA</button>}
      </>
    );
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) onSubmit(q.qtype === "numeric" ? text.trim() : text.trim()); }} className="grid gap-2">
      <input ref={inputRef} className="input" inputMode={q.qtype === "numeric" ? "decimal" : "text"} autoComplete="off" autoCapitalize="off" placeholder={q.qtype === "numeric" ? "Skriv ett tal" : q.qtype === "short" ? "Förklara kort med egna ord" : "Skriv ditt svar"} value={text} disabled={disabled} onChange={(e) => setText(e.target.value)} />
      {!result && <button className="btn-gold" disabled={disabled || !text.trim()}>SVARA</button>}
    </form>
  );
}

function WheelIntro({ s, onDone }: { s: SessionView; onDone: () => void }) {
  const fx = useFx();
  const w = s.public_meta.wheel as { index: number; subjects: { id: string; icon: string; name: string }[] };
  const n = w.subjects.length;
  const [rot, setRot] = useState(0);
  const [spun, setSpun] = useState(false);
  const seg = 360 / n;
  function spin() {
    fx.play("spin");
    // pointer at top: rotate so that segment `index` center lands at 0deg (top)
    const target = 360 * 5 - (w.index * seg + seg / 2);
    setRot(target);
    setSpun(true);
    setTimeout(() => { fx.play("coin"); }, 4200);
  }
  const colors = ["#0f3b2a", "#3b2a6b", "#5a3a0a", "#1e3a8a", "#6b1d2a", "#14532d", "#4c1d95", "#7c2d12", "#1e40af"];
  const bg = `conic-gradient(${w.subjects.map((_, i) => `${colors[i % colors.length]} ${i * seg}deg ${(i + 1) * seg}deg`).join(",")})`;
  return (
    <div className="page pt-6 text-center">
      <div className="serif text-[12px] tracking-[.2em] text-gold">KNOWLEDGE WHEEL</div>
      <p className="muted text-[13px] mt-1">Snurra – hjulet väljer ämne. Svårighetsgraden anpassas efter dig.</p>
      <div className="wheel-wrap mt-8">
        <div className="wheel" style={{ background: bg, transform: `rotate(${rot}deg)` }}>
          {w.subjects.map((sub, i) => (
            <span key={sub.id} className="lab" style={{ transform: `rotate(${i * seg + seg / 2}deg) translate(-50%, -112px)` }}>{sub.icon}</span>
          ))}
        </div>
        <div className="wheel-hub">KP</div>
      </div>
      {!spun ? (
        <button className="btn-gold mt-8" onClick={spin}>SNURRA</button>
      ) : (
        <div className="mt-8 fade-up">
          <div className="text-[18px] font-extrabold">{w.subjects[w.index].icon} {w.subjects[w.index].name}</div>
          <p className="muted text-[12px]">{s.total} frågor · {DIFF_LABEL[s.difficulty ?? "easy"]}</p>
          <button className="btn-gold mt-4" onClick={onDone}>KÖR</button>
        </div>
      )}
    </div>
  );
}

function SlotsIntro({ s, onDone }: { s: SessionView; onDone: () => void }) {
  const fx = useFx();
  const r = s.public_meta.reels as { subject: string; subject_name: string; difficulty: string; type: string };
  const [stage, setStage] = useState(0);
  function pull() {
    fx.play("spin");
    setStage(1);
    setTimeout(() => setStage(2), 900);
    setTimeout(() => setStage(3), 1600);
    setTimeout(() => { setStage(4); fx.play("coin"); }, 2300);
  }
  const diffIcon: Record<string, string> = { easy: "🟢", medium: "🟡", hard: "🟠", expert: "🔴" };
  return (
    <div className="page pt-6 text-center">
      <div className="serif text-[12px] tracking-[.2em] text-gold">KNOWLEDGE SLOTS</div>
      <p className="muted text-[13px] mt-1">Tre hjul: ämne, nivå och frågetyp. Inga pengar – bara kunskap.</p>
      <div className="flex justify-center gap-3 mt-8">
        <div className={`reel ${stage === 1 ? "spinning" : ""}`}><span>{stage >= 2 ? r.subject : "❔"}</span><small>Ämne</small></div>
        <div className={`reel ${stage >= 1 && stage < 3 ? "spinning" : ""}`}><span>{stage >= 3 ? diffIcon[r.difficulty] : "❔"}</span><small>Nivå</small></div>
        <div className={`reel ${stage >= 1 && stage < 4 ? "spinning" : ""}`}><span>{stage >= 4 ? "📝" : "❔"}</span><small>Typ</small></div>
      </div>
      {stage === 0 && <button className="btn-gold mt-8" onClick={pull}>DRA I SPAKEN</button>}
      {stage === 4 && (
        <div className="mt-8 fade-up">
          <div className="text-[18px] font-extrabold">{r.subject} {r.subject_name}</div>
          <p className="muted text-[12px]">{DIFF_LABEL[r.difficulty as keyof typeof DIFF_LABEL]} · {r.type} · {s.total} frågor</p>
          <button className="btn-gold mt-4" onClick={onDone}>KÖR</button>
        </div>
      )}
    </div>
  );
}

function Summary({ s, onReplay, askAi, aiText, aiBusy }: { s: SessionView; onReplay: () => void; askAi: (q: PublicQuestion | null, r: AnswerResult | null) => void; aiText: string | null; aiBusy: boolean }) {
  const fx = useFx();
  useEffect(() => { if (s.correct > 0) fx.play("win"); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const answered = s.answered;
  const pct = answered ? Math.round((s.correct / answered) * 100) : 0;
  const bonus = Number(s.public_meta.bonus ?? 0);
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="page pt-6 pb-8">
      <div className="card felt text-center">
        <div className="serif text-[12px] tracking-[.2em] text-gold">{s.status === "bust" ? "BUST!" : "RUNDAN KLAR"}</div>
        <div className="text-[44px] font-extrabold mt-2">{s.correct}/{answered}</div>
        <p className="muted text-[12px]">{pct} % rätt · {MODE_LABEL[s.mode]}{s.public_meta.subject_name ? ` · ${s.public_meta.subject_name as string}` : ""}</p>
        <div className="flex justify-center gap-2 mt-4 flex-wrap">
          <span className="pill g">+{s.xp_awarded} XP</span>
          <span className="pill e">+{s.coins_awarded} mynt</span>
          {bonus > 0 && <span className="pill p">Bonus +{bonus} · {String(s.public_meta.bonus_reason ?? "")}</span>}
        </div>
        {s.mode === "blackjack" && <p className="text-[13px] mt-3">Hand: {((s.public_meta.hand as number[]) ?? []).map((c) => (c === 11 ? "A" : c)).join(" + ")} = <b>{String(s.public_meta.hand_total ?? 0)}</b></p>}
      </div>
      <div className="flex gap-2 mt-4">
        <button className="btn-gold flex-1" onClick={onReplay}>{s.mode === "daily" ? "FLER SPEL" : "SPELA IGEN"}</button>
        <Link href="/home" className="btn-ghost flex-1">HEM</Link>
      </div>
      <div className="sec">
        <div className="sec-title">Genomgång</div>
        <div className="grid gap-2 mt-3">
          {(s.results ?? []).map((r) => (
            <div key={r.idx} className="card !p-3">
              <button className="w-full text-left flex gap-3 items-start" onClick={() => setOpen(open === r.idx ? null : r.idx)}>
                <span>{r.correct ? "✅" : "❌"}</span>
                <span className="flex-1 text-[13px] font-semibold">{r.prompt}</span>
                <span className="pill e">+{r.xp}</span>
              </button>
              {open === r.idx && (
                <div className="mt-2 text-[12px] border-t border-white/10 pt-2 grid gap-1">
                  <p><span className="muted">Ditt svar:</span> {r.your_answer}</p>
                  <p><span className="muted">Rätt svar:</span> {r.correct_answer}</p>
                  {r.explanation && <p className="mt-1">{r.explanation}</p>}
                  {aiText && open === r.idx ? (
                    <div className="bg-white/5 rounded-xl p-3 border border-purple/30 mt-1"><span className="pill p mb-1">AI-LÄRARE</span><p className="mt-1 whitespace-pre-wrap">{aiText}</p></div>
                  ) : (
                    <button className="btn-ghost text-[12px] mt-1 justify-self-start" disabled={aiBusy} onClick={() => askAi({ idx: r.idx, prompt: r.prompt, qtype: "mcq", options: null, difficulty: "medium", subject_id: s.subject_id ?? "", source: "verified" }, { correct: !!r.correct, correct_answer: r.correct_answer, explanation: r.explanation, xp: r.xp, coins: 0, finished: true, session: s, flags: [] })}>
                      {aiBusy ? "Tänker…" : "🧠 Förklara mer"}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
