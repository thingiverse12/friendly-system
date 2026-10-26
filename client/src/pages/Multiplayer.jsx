import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { Spinner, useToast } from '../components/ui.jsx';
import { ROOM_MODES, SCORE_SYSTEMS } from '../../../shared/constants.js';

export function Multiplayer() {
  const navigate = useNavigate();
  const toast = useToast();
  const [cases, setCases] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [code, setCode] = useState('');
  const [form, setForm] = useState({ caseId: '', mode: 'cooperative', scoreSystem: 'realistic', guessLimit: 0, hintRules: 'on', difficulty: 'normal' });

  useEffect(() => {
    api.get('/cases').then((d) => { setCases(d.cases); setForm((f) => ({ ...f, caseId: d.cases[0]?.id || '', difficulty: d.cases[0]?.difficulty || 'normal' })); });
    api.get('/rooms/mine').then((d) => setRooms((d.sessions || []).filter((s) => s.mode !== 'solo')));
  }, []);

  const join = async (e) => {
    e.preventDefault();
    try {
      const d = await api.post('/rooms/join', { code: code.trim() });
      navigate(`/rum/${d.room.id}`);
    } catch (err) { toast(err.message, 'error'); }
  };

  const create = async () => {
    const d = await api.post('/rooms', { ...form, guessLimit: Number(form.guessLimit) });
    navigate(`/rum/${d.room.id}`);
  };

  if (!cases) return <Spinner />;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Multiplayer</h1>
          <p>Privata rum med rumskod eller inbjudningslänk. Välj samarbete eller tävling innan fallet startar.</p>
        </div>
      </div>

      <div className="grid grid-2">
        <section className="card stack">
          <h2>Gå med i rum</h2>
          <form onSubmit={join} className="row">
            <input className="input" placeholder="Rumskod, t.ex. ZX7K-9P2" aria-label="Rumskod"
              value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={12} />
            <button className="btn btn-primary">Anslut</button>
          </form>
          <p className="faint small">Bara inbjudna med koden kan ansluta. Borttagna spelare nekas automatiskt.</p>
        </section>

        <section className="card stack">
          <h2>Skapa privat rum</h2>
          <div className="field">
            <label htmlFor="case">Fall</label>
            <select id="case" className="select" value={form.caseId}
              onChange={(e) => setForm({ ...form, caseId: e.target.value, difficulty: cases.find((c) => c.id === e.target.value)?.difficulty })}>
              {cases.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          <div className="grid grid-2">
            <div className="field">
              <label htmlFor="mode">Läge</label>
              <select id="mode" className="select" value={form.mode}
                onChange={(e) => setForm({ ...form, mode: e.target.value, scoreSystem: e.target.value === 'competitive' ? 'competitive' : form.scoreSystem })}>
                <option value="cooperative">{ROOM_MODES.cooperative}</option>
                <option value="competitive">{ROOM_MODES.competitive}</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="score">Poängsystem</label>
              <select id="score" className="select" value={form.scoreSystem} onChange={(e) => setForm({ ...form, scoreSystem: e.target.value })}>
                {Object.entries(SCORE_SYSTEMS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="gl">Slutgissningar (0 = obegränsat)</label>
              <input id="gl" type="number" min="0" max="10" className="input" value={form.guessLimit}
                onChange={(e) => setForm({ ...form, guessLimit: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="hr">Ledtrådar</label>
              <select id="hr" className="select" value={form.hintRules} onChange={(e) => setForm({ ...form, hintRules: e.target.value })}>
                <option value="on">På</option>
                <option value="off">Av</option>
              </select>
            </div>
          </div>
          <button className="btn btn-primary btn-block" onClick={create}>Skapa rum och bjud in</button>
        </section>
      </div>

      <h2 style={{ marginTop: 26 }}>Mina multiplayer-rum</h2>
      {rooms.length === 0 ? (
        <div className="card empty-state"><h3>Inga multiplayer-rum ännu</h3><p className="muted">Skapa ett och bjud in vännerna med koden.</p></div>
      ) : (
        <div className="grid grid-2">
          {rooms.map((r) => (
            <button key={r.id} className="card card-hover" style={{ textAlign: 'left' }} onClick={() => navigate(`/rum/${r.room_id}`)}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <h3 className="tight">{r.title}</h3>
                <span className="badge badge-red">{r.code}</span>
              </div>
              <p className="faint small" style={{ marginTop: 8 }}>{ROOM_MODES[r.mode]} · {r.status === 'solved' ? 'löst' : 'pågående'}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
