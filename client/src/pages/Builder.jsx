import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../api.js';
import { Spinner, useToast, EmptyState } from '../components/ui.jsx';
import { CASE_TYPES, ENVIRONMENTS, DIFFICULTIES, EVIDENCE_CATEGORIES, SOURCE_STATUS, CASE_STATUSES } from '../../../shared/constants.js';

const uid = (p) => `${p}_${Math.random().toString(36).slice(2, 9)}`;

function blankDocument() {
  return {
    title: '', intro: '', caseType: 'murder', environment: 'forest_house', difficulty: 'normal',
    playtimeMin: 60, briefing: [''], locations: [{ id: uid('place'), name: 'Brottsplats', kind: 'place' }],
    persons: [{
      personId: uid('person'), kind: 'suspect', name: '', age: 40, roleTitle: '', initials: '', color: '#c8102e',
      publicProfile: { bakgrund: '', yrke: '', bor: '', relationer: '', snabbfakta: [] },
      secret: {
        isCulprit: false, knows: [], believes: [], hides: [],
        alibi: { claim: '', truth: '', reliability: 'false', evidenceIds: [] },
        suggestedQuestions: ['Var befann du dig på kvällen?'],
        questions: [{ keywords: ['alibi'], answer: '', truthful: false }],
        evidenceReactions: {}, genericLines: ['Jag har inget att tillägga.'],
      },
    }],
    events: [{ id: uid('e'), time: '20:00', label: '', detail: '', kind: 'confirmed', isPublic: true, secretNote: '' }],
    evidence: [{
      id: uid('ev'), category: 'document', title: '', description: '', sourceStatus: 'fact',
      location: '', image: '', discoverHint: '', secretMeaning: '',
    }],
    witnessStatements: [],
    hints: ['', '', ''],
    boardLinks: [],
    assistantInsights: {},
    solution: {
      culpritId: '', motive: '', narrative: '',
      realTimeline: [{ time: '20:00', text: '' }],
      decisiveEvidence: [], alternativeExplanations: [{ personId: '', whySeemedGuilty: '', contradictedBy: [], explanation: '' }],
    },
  };
}

export function BuilderList() {
  const [cases, setCases] = useState(null);
  const navigate = useNavigate();
  const load = () => api.get('/builder/cases').then((d) => setCases(d.cases));
  useEffect(() => { load(); }, []);
  if (!cases) return <Spinner />;

  const create = async () => {
    const d = await api.post('/builder/cases', blankDocument());
    navigate(`/byggare/${d.caseId}`);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Fallbyggaren</h1>
          <p>Skapa egna mysterier. Utkast förblir privata tills de passerar de obligatoriska kvalitetskontrollerna.</p>
        </div>
        <button className="btn btn-primary" onClick={create}>+ Nytt fall</button>
      </div>
      {cases.length === 0 ? (
        <EmptyState title="Inga utkast ännu" action={<button className="btn btn-primary" onClick={create}>Skapa ditt första fall</button>} />
      ) : (
        <div className="grid grid-2">
          {cases.map((c) => (
            <div key={c.id} className="card stack">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <h3 className="tight">{c.title || 'Namnlöst utkast'}</h3>
                <span className={`status-pill status-${c.status}`}>{CASE_STATUSES[c.status] || c.status}</span>
              </div>
              <p className="small faint tight">Version {c.version} · {CASE_TYPES[c.caseType]} · uppdaterat {new Date(c.updatedAt).toLocaleDateString('sv-SE')}</p>
              {c.validation && (
                <p className="small tight">
                  Senaste validering: {c.validation.passed
                    ? <span className="source-fact">godkänd</span>
                    : <span style={{ color: 'var(--red-hover)' }}>{c.validation.summary?.errors || 0} kritiska fel</span>}
                </p>
              )}
              <div className="row-wrap">
                <Link className="btn btn-subtle btn-sm" to={`/byggare/${c.id}`}>Öppna</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function BuilderEditor() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [doc, setDoc] = useState(null);
  const [meta, setMeta] = useState(null);
  const [report, setReport] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get(`/builder/cases/${caseId}`).then((d) => { setDoc(d.document); setMeta(d.meta); setReport(d.validation); });
  }, [caseId]);

  if (!doc) return <Spinner />;
  const upd = (patch) => setDoc((d) => ({ ...d, ...patch }));
  const updatePerson = (i, patch) => setDoc((d) => {
    const persons = [...d.persons];
    persons[i] = { ...persons[i], ...patch };
    return { ...d, persons };
  });
  const updateRow = (key, i, patch) => setDoc((d) => {
    const rows = [...d[key]];
    rows[i] = { ...rows[i], ...patch };
    return { ...d, [key]: rows };
  });
  const addRow = (key, factory) => setDoc((d) => ({ ...d, [key]: [...d[key], factory()] }));
  const removeRow = (key, i) => setDoc((d) => ({ ...d, [key]: d[key].filter((_, idx) => idx !== i) }));

  const save = async (publish = false) => {
    setSaving(true);
    try {
      const saved = await api.put(`/builder/cases/${caseId}`, doc);
      toast(publish ? 'Ny version sparad' : 'Utkast sparat', 'success');
      if (saved.caseId !== caseId) navigate(`/byggare/${saved.caseId}`, { replace: true });
      return saved.caseId;
    } catch (err) { toast(err.message, 'error'); throw err; }
    finally { setSaving(false); }
  };

  const validate = async () => {
    try {
      const d = await api.post(`/builder/cases/${caseId}/validate`, doc);
      setReport(d);
      toast(d.passed ? 'Validering godkänd' : 'Kritiska fel hittades', d.passed ? 'success' : 'error');
    } catch (err) { toast(err.message, 'error'); }
  };

  const publish = async () => {
    try {
      await save();
      await api.post(`/builder/cases/${caseId}/publish`, {});
      toast('Fallet publicerat i katalogen', 'success');
      navigate('/katalog');
    } catch (err) {
      if (err.status === 422) { setReport({ passed: false, findings: err.details?.map((m) => ({ severity: 'error', code: 'BLOCK', message: m })) || [] }); toast('Publicering blockerad – rätta felen först', 'error'); }
      else toast(err.message, 'error');
    }
  };

  const testPlay = async () => {
    const d = await api.post(`/builder/cases/${caseId}/test-room`, {});
    navigate(`/rum/${d.roomId}`);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <Link to="/byggare" className="small">← Alla utkast</Link>
          <h1 style={{ marginTop: 6 }}>{doc.title || 'Namnlöst fall'}</h1>
          <p>Version {meta?.version} · status {CASE_STATUSES[meta?.status] || meta?.status}. Hemliga fält markeras och lämnar aldrig servern i publika svar.</p>
        </div>
        <div className="row-wrap">
          <button className="btn btn-subtle" disabled={saving} onClick={() => save()}><span>Spara utkast</span></button>
          <button className="btn btn-subtle" onClick={validate}>Validera</button>
          <button className="btn btn-ghost" onClick={testPlay}>Testläge</button>
          <button className="btn btn-primary" disabled={report && !report.passed} onClick={publish}>Publicera</button>
        </div>
      </div>

      <div className="grid builder-grid">
        <div className="stack">
          <section className="card builder-section">
            <h3>1. Grunder</h3>
            <div className="grid-form">
              <div className="field"><label>Titel</label><input className="input" value={doc.title} onChange={(e) => upd({ title: e.target.value })} /></div>
              <div className="field"><label>Speltid (min)</label><input type="number" className="input" value={doc.playtimeMin} onChange={(e) => upd({ playtimeMin: Number(e.target.value) })} /></div>
            </div>
            <div className="field"><label>Introduktion</label><textarea className="textarea" value={doc.intro} onChange={(e) => upd({ intro: e.target.value })} /></div>
            <div className="grid-form">
              <div className="field"><label>Falltyp</label>
                <select className="select" value={doc.caseType} onChange={(e) => upd({ caseType: e.target.value })}>
                  {Object.entries(CASE_TYPES).map(([id, l]) => <option key={id} value={id}>{l}</option>)}
                </select>
              </div>
              <div className="field"><label>Miljö</label>
                <select className="select" value={doc.environment} onChange={(e) => upd({ environment: e.target.value })}>
                  {Object.entries(ENVIRONMENTS).map(([id, l]) => <option key={id} value={id}>{l}</option>)}
                </select>
              </div>
              <div className="field"><label>Svårighetsgrad</label>
                <select className="select" value={doc.difficulty} onChange={(e) => upd({ difficulty: e.target.value })}>
                  {Object.entries(DIFFICULTIES).map(([id, d]) => <option key={id} value={id}>{d.label}</option>)}
                </select>
              </div>
            </div>
            <div className="field"><label>Briefing (en paragraf per rad)</label>
              <textarea className="textarea" value={(doc.briefing || []).join('\n')}
                onChange={(e) => upd({ briefing: e.target.value.split('\n') })} />
            </div>
          </section>

          <section className="card builder-section">
            <h3>2. Personer <button className="btn btn-ghost btn-sm" onClick={() => addRow('persons', () => blankDocument().persons[0])}>+ Lägg till</button></h3>
            {doc.persons.map((p, i) => (
              <div key={p.personId} className="builder-section">
                <div className="grid-form">
                  <div className="field"><label>Namn</label><input className="input" value={p.name} onChange={(e) => updatePerson(i, { name: e.target.value })} /></div>
                  <div className="field"><label>Roll</label><input className="input" value={p.roleTitle} onChange={(e) => updatePerson(i, { roleTitle: e.target.value })} /></div>
                  <div className="field"><label>Typ</label>
                    <select className="select" value={p.kind} onChange={(e) => updatePerson(i, { kind: e.target.value })}>
                      <option value="suspect">Misstänkt</option><option value="witness">Vittne</option><option value="victim">Offer</option>
                    </select>
                  </div>
                  <div className="field"><label>Ålder</label><input type="number" className="input" value={p.age} onChange={(e) => updatePerson(i, { age: Number(e.target.value) })} /></div>
                </div>
                <div className="field"><label>Bakgrund (offentlig)</label>
                  <textarea className="textarea" value={p.publicProfile?.bakgrund || ''}
                    onChange={(e) => updatePerson(i, { publicProfile: { ...p.publicProfile, bakgrund: e.target.value } })} />
                </div>
                <label className="row small" style={{ gap: 8 }}>
                  <input type="checkbox" checked={!!p.secret?.isCulprit}
                    onChange={(e) => updatePerson(i, { secret: { ...p.secret, isCulprit: e.target.checked } })} />
                  <span className="secret-flag">HEMLIGT</span> Denna person är gärningspersonen
                </label>
                <div className="field" style={{ marginTop: 10 }}>
                  <label><span className="secret-flag">HEMLIGT</span> Kunskapsmodell (JSON: knows, believes, hides, alibi, questions, evidenceReactions…)</label>
                  <JsonArea value={p.secret} onChange={(secret) => updatePerson(i, { secret })} />
                </div>
                <button className="btn btn-danger btn-sm" onClick={() => removeRow('persons', i)}>Ta bort person</button>
              </div>
            ))}
          </section>

          <section className="card builder-section">
            <h3>3. Bevis <button className="btn btn-ghost btn-sm" onClick={() => addRow('evidence', () => blankDocument().evidence[0])}>+ Lägg till</button></h3>
            {doc.evidence.map((e, i) => (
              <div key={e.id} className="builder-section">
                <div className="grid-form">
                  <div className="field"><label>Titel</label><input className="input" value={e.title} onChange={(ev) => updateRow('evidence', i, { title: ev.target.value })} /></div>
                  <div className="field"><label>Kategori</label>
                    <select className="select" value={e.category} onChange={(ev) => updateRow('evidence', i, { category: ev.target.value })}>
                      {Object.entries(EVIDENCE_CATEGORIES).map(([id, l]) => <option key={id} value={id}>{l}</option>)}
                    </select>
                  </div>
                  <div className="field"><label>Källstatus</label>
                    <select className="select" value={e.sourceStatus} onChange={(ev) => updateRow('evidence', i, { sourceStatus: ev.target.value })}>
                      {Object.entries(SOURCE_STATUS).map(([id, s]) => <option key={id} value={id}>{s.label}</option>)}
                    </select>
                  </div>
                  <div className="field"><label>Plats</label><input className="input" value={e.location} onChange={(ev) => updateRow('evidence', i, { location: ev.target.value })} /></div>
                </div>
                <div className="field"><label>Beskrivning (offentlig)</label><textarea className="textarea" value={e.description} onChange={(ev) => updateRow('evidence', i, { description: ev.target.value })} /></div>
                <div className="field"><label>Upptäcktstips</label><input className="input" value={e.discoverHint} onChange={(ev) => updateRow('evidence', i, { discoverHint: ev.target.value })} /></div>
                <div className="field"><label><span className="secret-flag">HEMLIGT</span> Betydelse i facit</label><textarea className="textarea" value={e.secretMeaning} onChange={(ev) => updateRow('evidence', i, { secretMeaning: ev.target.value })} /></div>
                <button className="btn btn-danger btn-sm" onClick={() => removeRow('evidence', i)}>Ta bort bevis</button>
              </div>
            ))}
          </section>
        </div>

        <div className="stack">
          <section className="card builder-section">
            <h3>4. Tidslinje <button className="btn btn-ghost btn-sm" onClick={() => addRow('events', () => blankDocument().events[0])}>+ Lägg till</button></h3>
            {doc.events.map((e, i) => (
              <div key={e.id} className="builder-section">
                <div className="grid-form">
                  <div className="field"><label>Klockslag</label><input className="input" value={e.time} onChange={(ev) => updateRow('events', i, { time: ev.target.value })} /></div>
                  <div className="field"><label>Status</label>
                    <select className="select" value={e.kind} onChange={(ev) => updateRow('events', i, { kind: ev.target.value })}>
                      <option value="confirmed">Bekräftad</option><option value="claimed">Uppgift</option><option value="uncertain">Osäker</option>
                    </select>
                  </div>
                </div>
                <div className="field"><label>Rubrik</label><input className="input" value={e.label} onChange={(ev) => updateRow('events', i, { label: ev.target.value })} /></div>
                <div className="field"><label>Detalj</label><input className="input" value={e.detail} onChange={(ev) => updateRow('events', i, { detail: ev.target.value })} /></div>
                <div className="field"><label><span className="secret-flag">HEMLIGT</span> Inre notis</label><input className="input" value={e.secretNote} onChange={(ev) => updateRow('events', i, { secretNote: ev.target.value })} /></div>
                <button className="btn btn-danger btn-sm" onClick={() => removeRow('events', i)}>Ta bort</button>
              </div>
            ))}
          </section>

          <section className="card builder-section">
            <h3>5. Ledtrådar (tre nivåer)</h3>
            {doc.hints.map((h, i) => (
              <div className="field" key={i}><label>Nivå {i + 1}</label>
                <textarea className="textarea" value={h} onChange={(e) => setDoc((d) => { const hints = [...d.hints]; hints[i] = e.target.value; return { ...d, hints }; })} />
              </div>
            ))}
          </section>

          <section className="card builder-section">
            <h3>6. Facit <span className="secret-flag">HEMLIGT</span></h3>
            <div className="field"><label>Gärningsperson (personId)</label>
              <select className="select" value={doc.solution.culpritId} onChange={(e) => setDoc((d) => ({ ...d, solution: { ...d.solution, culpritId: e.target.value } }))}>
                <option value="">Välj…</option>
                {doc.persons.map((p) => <option key={p.personId} value={p.personId}>{p.name || p.personId}</option>)}
              </select>
            </div>
            <div className="field"><label>Motiv</label><textarea className="textarea" value={doc.solution.motive} onChange={(e) => setDoc((d) => ({ ...d, solution: { ...d.solution, motive: e.target.value } }))} /></div>
            <div className="field"><label>Händelseförlopp</label><textarea className="textarea" value={doc.solution.narrative} onChange={(e) => setDoc((d) => ({ ...d, solution: { ...d.solution, narrative: e.target.value } }))} /></div>
            <div className="field"><label>Avgörande bevis (id:n, kommaseparerade)</label>
              <input className="input" value={doc.solution.decisiveEvidence.join(', ')}
                onChange={(e) => setDoc((d) => ({ ...d, solution: { ...d.solution, decisiveEvidence: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) } }))} />
            </div>
          </section>

          <section className="card builder-section">
            <h3>7. Kvalitetsrapport</h3>
            {!report ? <p className="faint small">Tryck på Validera för att köra de automatiska logiktesterna och den oberoende AI-utredaren.</p> : (
              <>
                <div className={`alert ${report.passed ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 12 }}>
                  {report.passed ? 'Alla kritiska kontroller passerade. Manuell provspelning rekommenderas ändå.' : 'Fallet kan inte publiceras förrän de kritiska felen är åtgärdade.'}
                </div>
                {(report.findings || []).map((f, i) => (
                  <div key={i} className={`finding ${f.severity}`}><strong>[{f.code}]</strong> {f.message}</div>
                ))}
                {report.investigator && (
                  <div className="alert alert-info" style={{ marginTop: 10 }}>
                    <strong>Oberoende utredare (Kontroll B):</strong> {report.investigator.conclusion}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function JsonArea({ value, onChange }) {
  const [text, setText] = useState(JSON.stringify(value, null, 2));
  const [error, setError] = useState(null);
  return (
    <>
      <textarea className="textarea" style={{ fontFamily: 'monospace', fontSize: '.8rem', minHeight: 220 }}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          try { onChange(JSON.parse(e.target.value)); setError(null); }
          catch (err) { setError('Ogiltig JSON: ' + err.message); }
        }} />
      {error && <p className="error-text">{error}</p>}
    </>
  );
}
