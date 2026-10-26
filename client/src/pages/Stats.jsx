import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Spinner } from '../components/ui.jsx';
import { DIFFICULTIES } from '../../../shared/constants.js';

export function Stats() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get('/cases/stats/me').then(setData); }, []);
  if (!data) return <Spinner />;
  const { stats, achievements } = data;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Statistik och prestationer</h1>
          <p>Aggregerade mått utan att lagra dina privata teorier eller facit i analysloggar.</p>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 22 }}>
        <div className="stat"><div className="num">{stats.started}</div><div className="lbl">Startade utredningar</div></div>
        <div className="stat"><div className="num">{stats.solved}</div><div className="lbl">Lösta fall</div></div>
        <div className="stat"><div className="num">{stats.solveRate}%</div><div className="lbl">Lösningsfrekvens</div></div>
        <div className="stat"><div className="num">{stats.totalScore}</div><div className="lbl">Tävlingspoäng</div></div>
        <div className="stat"><div className="num">{stats.discovered}</div><div className="lbl">Säkrade bevis</div></div>
        <div className="stat"><div className="num">{stats.interrogations}</div><div className="lbl">Genomförda förhör</div></div>
        <div className="stat"><div className="num">{stats.hints}</div><div className="lbl">Använda ledtrådar</div></div>
      </div>

      <h2>Fördelning per svårighetsgrad</h2>
      <div className="card" style={{ marginBottom: 22 }}>
        {stats.byDifficulty.length === 0 && <p className="faint small">Inga utredningar ännu.</p>}
        {stats.byDifficulty.map((d) => (
          <div key={d.difficulty} className="row" style={{ justifyContent: 'space-between', padding: '6px 0' }}>
            <span>{DIFFICULTIES[d.difficulty]?.label || d.difficulty}</span>
            <strong>{d.n}</strong>
          </div>
        ))}
      </div>

      <h2>Prestationer</h2>
      <div className="grid grid-3">
        {achievements.map((a) => (
          <div key={a.id} className="card" style={{ opacity: a.unlocked ? 1 : 0.55 }}>
            <div className="row">
              <span className={`dot ${a.unlocked ? 'dot-green' : 'dot-muted'}`} />
              <strong>{a.label}</strong>
            </div>
            <p className="small muted tight" style={{ marginTop: 6 }}>{a.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
