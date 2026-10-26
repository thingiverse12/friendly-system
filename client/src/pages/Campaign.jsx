import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { Spinner, DifficultyBadge } from '../components/ui.jsx';

export function Campaign() {
  const [data, setData] = useState(null);
  const navigate = useNavigate();
  useEffect(() => { api.get('/cases/campaigns/active').then((d) => setData(d.campaign)); }, []);
  if (!data) return <Spinner />;

  const start = async (caseId) => {
    const room = await api.post('/rooms', { caseId, mode: 'solo', scoreSystem: 'realistic', guessLimit: 0, hintRules: 'on' });
    navigate(`/rum/${room.room.id}`);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{data.title}</h1>
          <p>{data.description}</p>
        </div>
        <span className="badge badge-blue">{data.progress.completed.length}/{data.entries.length} kapitel klara</span>
      </div>

      <div className="stack">
        {data.entries.map((e, i) => {
          const done = data.progress.completed.includes(e.case_id);
          const locked = e.ordinal > data.progress.currentOrdinal && !done;
          return (
            <div key={e.case_id} className={`chapter-row ${done ? 'done' : ''} ${locked ? 'locked' : ''}`}>
              <span className="chapter-num">{done ? '✓' : e.ordinal}</span>
              <div style={{ flex: 1 }}>
                <h3 className="tight">{e.ordinal}. {e.title}</h3>
                <p className="small muted tight">{e.intro}</p>
                <div style={{ marginTop: 6 }}><DifficultyBadge id={e.difficulty} /></div>
              </div>
              {locked ? <span className="badge">Låst</span>
                : <button className="btn btn-primary btn-sm" onClick={() => start(e.case_id)}>{done ? 'Spela igen' : 'Starta'}</button>}
            </div>
          );
        })}
        {data.lockedChapters.map((ch) => (
          <div key={ch.ordinal} className="chapter-row locked">
            <span className="chapter-num">{ch.ordinal}</span>
            <div style={{ flex: 1 }}>
              <h3 className="tight faint">{ch.title}</h3>
              <p className="small faint tight">Kommande kapitel – kommande berättelse är under produktion.</p>
            </div>
            <span className="badge">Kommer snart</span>
          </div>
        ))}
      </div>
      <p className="faint small" style={{ marginTop: 18 }}>
        Varje kapitel har ett eget låst facit. Tidigare val påverkar kampanjjournalen men ändrar aldrig sanningen i ett påbörjat fall.
      </p>
    </div>
  );
}
