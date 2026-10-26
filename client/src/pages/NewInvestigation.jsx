import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { DifficultyBadge, Spinner } from '../components/ui.jsx';
import { DIFFICULTIES, ROOM_MODES, SCORE_SYSTEMS, CASE_TYPES, ENVIRONMENTS } from '../../../shared/constants.js';

export function NewInvestigation() {
  const navigate = useNavigate();
  const [cases, setCases] = useState(null);
  const [busy, setBusy] = useState(false);
  const [quickDiff, setQuickDiff] = useState('normal');
  const [adv, setAdv] = useState({
    caseId: '', mode: 'solo', scoreSystem: 'realistic', difficulty: 'normal',
    guessLimit: 0, hintRules: 'on', presentation: 'text',
  });

  useEffect(() => { api.get('/cases').then((d) => { setCases(d.cases); setAdv((a) => ({ ...a, caseId: d.cases[0]?.id || '' })); }); }, []);

  const selectedCase = useMemo(() => cases?.find((c) => c.id === adv.caseId), [cases, adv.caseId]);

  const quickstart = async () => {
    setBusy(true);
    try {
      const d = await api.post('/rooms/quickstart', { difficulty: quickDiff });
      navigate(`/rum/${d.room.id}`);
    } finally { setBusy(false); }
  };

  const startAdvanced = async () => {
    setBusy(true);
    try {
      const d = await api.post('/rooms', { ...adv, guessLimit: Number(adv.guessLimit) });
      navigate(`/rum/${d.room.id}`);
    } finally { setBusy(false); }
  };

  if (!cases) return <Spinner />;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Starta en utredning</h1>
          <p>Välj mellan snabbstart eller fullständiga inställningar. Fallet versionslåses när rummet skapas.</p>
        </div>
      </div>

      <div className="grid grid-2">
        <section className="card">
          <h2>Snabbstart</h2>
          <p className="muted small">Systemet väljer ett kvalitetssäkrat, godkänt fall. Introduktionen presenterar händelsen utan att avslöja facit.</p>
          <div className="field">
            <label htmlFor="qd">Svårighetsgrad</label>
            <select id="qd" className="select" value={quickDiff} onChange={(e) => setQuickDiff(e.target.value)}>
              {Object.values(DIFFICULTIES).map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </div>
          <button className="btn btn-primary btn-block" disabled={busy} onClick={quickstart}>Starta direkt</button>
        </section>

        <section className="card">
          <h2>Avancerade inställningar</h2>
          <div className="field">
            <label htmlFor="case">Välj fall</label>
            <select id="case" className="select" value={adv.caseId} onChange={(e) => setAdv({ ...adv, caseId: e.target.value, difficulty: cases.find((c) => c.id === e.target.value)?.difficulty || adv.difficulty })}>
              {cases.map((c) => <option key={c.id} value={c.id}>{c.title} ({CASE_TYPES[c.caseType]})</option>)}
            </select>
          </div>
          {selectedCase && (
            <div className="alert alert-info" style={{ marginBottom: 14 }}>
              <strong>{selectedCase.title}</strong> — {ENVIRONMENTS[selectedCase.environment]}, ca {selectedCase.playtimeMin} min.
              Den låsta svårighetsgraden är <DifficultyBadge id={selectedCase.difficulty} />.
            </div>
          )}
          <div className="grid grid-2">
            <div className="field">
              <label htmlFor="mode">Spelläge</label>
              <select id="mode" className="select" value={adv.mode} onChange={(e) => setAdv({ ...adv, mode: e.target.value, scoreSystem: e.target.value === 'competitive' ? 'competitive' : adv.scoreSystem })}>
                {Object.entries(ROOM_MODES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="score">Poängsystem</label>
              <select id="score" className="select" value={adv.scoreSystem} onChange={(e) => setAdv({ ...adv, scoreSystem: e.target.value })}>
                {Object.entries(SCORE_SYSTEMS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="hints">Ledtrådssystem</label>
              <select id="hints" className="select" value={adv.hintRules} onChange={(e) => setAdv({ ...adv, hintRules: e.target.value })}>
                <option value="on">På (tre nivåer)</option>
                <option value="off">Av</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="guess">Antal slutgissningar (0 = obegränsat)</label>
              <input id="guess" type="number" min="0" max="10" className="input" value={adv.guessLimit}
                onChange={(e) => setAdv({ ...adv, guessLimit: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="pres">Presentation</label>
              <select id="pres" className="select" value={adv.presentation} onChange={(e) => setAdv({ ...adv, presentation: e.target.value })}>
                <option value="text">Textbaserad</option>
                <option value="cinematic">Filmisk (berättarröst i webbläsaren)</option>
              </select>
            </div>
          </div>

          <div className="accusation-summary" style={{ marginBottom: 14 }}>
            <h3>Sammanfattning innan start</h3>
            <ul className="small muted" style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              <li>Fall: {selectedCase?.title}</li>
              <li>Läge: {ROOM_MODES[adv.mode]} · {SCORE_SYSTEMS[adv.scoreSystem]}</li>
              <li>Ledtrådar: {adv.hintRules === 'on' ? 'på' : 'av'} · slutgissningar: {Number(adv.guessLimit) === 0 ? 'obegränsade' : adv.guessLimit}</li>
              <li>Presentation: {adv.presentation === 'text' ? 'textbaserad' : 'filmisk'}</li>
            </ul>
          </div>
          <button className="btn btn-primary btn-block" disabled={busy || !adv.caseId} onClick={startAdvanced}>Skapa och starta</button>
        </section>
      </div>
    </div>
  );
}
