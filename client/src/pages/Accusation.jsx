import { useState } from 'react';
import { api } from '../api.js';
import { useToast } from '../components/ui.jsx';

export function Accusation({ roomState, onSolved, goSolution }) {
  const toast = useToast();
  const roomId = roomState.room.id;
  const suspects = roomState.case.persons.filter((p) => p.kind === 'suspect');
  const discovered = roomState.case.evidence.filter((e) => roomState.discoveredEvidence.includes(e.id));
  const [form, setForm] = useState({ suspectId: '', motive: '', evidenceIds: [], narrative: '' });
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const toggleEvidence = (id) => setForm((f) => ({
    ...f,
    evidenceIds: f.evidenceIds.includes(id) ? f.evidenceIds.filter((x) => x !== id) : [...f.evidenceIds, id],
  }));

  const submit = async () => {
    if (!form.suspectId) { toast('Välj en misstänkt.', 'error'); return; }
    setBusy(true);
    try {
      const d = await api.post(`/rooms/${roomId}/accusations`, form);
      setResult(d);
      if (d.correct) {
        toast('Anklagelsen är korrekt.', 'success');
        onSolved?.();
      } else {
        toast('Anklagelsen är felaktig. Gå tillbaka till bevisen.', 'error');
      }
    } catch (err) {
      toast(err.message, 'error');
    } finally { setBusy(false); }
  };

  const limitReached = result && roomState.room.guessLimit > 0 && result.guessesUsed >= roomState.room.guessLimit && !result.correct;

  return (
    <div className="grid builder-grid">
      <form className="card stack" onSubmit={(e) => e.preventDefault()}>
        <h2>Slutlig anklagelse</h2>
        <p className="muted small">Välj misstänkt, beskriv motivet, peka ut de viktigaste bevisen och redogör för händelseförloppet. Allt bedöms av servern mot den låsta fallmodellen.</p>
        <div className="field">
          <label htmlFor="suspect">Misstänkt</label>
          <select id="suspect" className="select" value={form.suspectId} onChange={(e) => setForm({ ...form, suspectId: e.target.value })}>
            <option value="">Välj misstänkt…</option>
            {suspects.map((p) => <option key={p.personId} value={p.personId}>{p.name} – {p.roleTitle}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="motive">Motiv (frivilligt men ger poäng i tävlingsläge)</label>
          <textarea id="motive" className="textarea" value={form.motive} onChange={(e) => setForm({ ...form, motive: e.target.value })}
            placeholder="Beskriv varför personen skulle ha begått brottet…" />
        </div>
        <div className="field">
          <label>Viktigaste bevisen (flera val möjliga)</label>
          <div className="row-wrap">
            {discovered.length === 0 && <span className="faint small">Säkra bevis först.</span>}
            {discovered.map((e) => (
              <button type="button" key={e.id}
                className={`btn btn-sm ${form.evidenceIds.includes(e.id) ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => toggleEvidence(e.id)}>{e.title}</button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="narr">Redogörelse av händelseförloppet</label>
          <textarea id="narr" className="textarea" value={form.narrative} onChange={(e) => setForm({ ...form, narrative: e.target.value })}
            placeholder="Vad hände, i vilken ordning, och varför?" />
        </div>
        <button className="btn btn-primary btn-block" disabled={busy || limitReached} onClick={submit}>
          {busy ? 'Bedömer…' : 'Lämna slutlig anklagelse'}
        </button>
        {roomState.room.guessLimit > 0 && (
          <p className="help-text">Max {roomState.room.guessLimit} slutgissningar i det här rummet.</p>
        )}
      </form>

      <div className="card">
        <h2>Utfall</h2>
        {!result ? (
          <p className="faint">Din anklagelse bedöms här. Facit visas aldrig i förtid – inte ens via API-anrop.</p>
        ) : (
          <div className="stack">
            <span className={`stamp ${result.correct ? 'correct' : ''}`}>{result.correct ? 'Korrekt' : 'Felaktig'}</span>
            <div className="accusation-summary">
              <h3>Bedömning</h3>
              <ul className="small" style={{ paddingLeft: 18 }}>
                <li>Personidentifiering: {result.scoreDetail.culpritCorrect ? 'korrekt' : 'felaktig'}</li>
                <li>Motiv: {result.scoreDetail.motiveCorrect ? 'underbyggt' : 'saknas/otillräckligt'}</li>
                <li>Korrekt utvalda avgörande bevis: {result.scoreDetail.evidenceHits.length}</li>
              </ul>
              {roomState.room.scoreSystem === 'competitive' && <p className="small muted">Poäng den här omgången: {result.points}</p>}
            </div>
            {result.correct ? (
              <button className="btn btn-primary" onClick={goSolution}>Visa fullständig lösning</button>
            ) : limitReached ? (
              <button className="btn btn-ghost" onClick={goSolution}>Visa lösning (gissningar förbrukade)</button>
            ) : (
              <p className="muted small">I samarbetsläge kan laget fortsätta utreda – en felgissning stänger inte rummet. Kontrollera alibin mot tekniska fakta och försök igen.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
