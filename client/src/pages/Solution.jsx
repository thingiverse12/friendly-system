import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Spinner, Avatar } from '../components/ui.jsx';

export function Solution({ roomState }) {
  const roomId = roomState.room.id;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [campaign, setCampaign] = useState(null);

  const load = async () => {
    try {
      const d = await api.get(`/rooms/${roomId}/solution`);
      setData(d);
      if (d.solution) {
        api.get('/cases/campaigns/active').then((c) => {
          const entry = c.campaign?.entries?.find((e) => e.case_id === roomState.room.caseId);
          if (entry) api.post(`/cases/campaigns/${c.campaign.id}/complete/${entry.case_id}`, {}).catch(() => {});
          setCampaign(c.campaign);
        }).catch(() => {});
      }
    } catch (err) { setError(err.message); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [roomId]);

  if (error) return <div className="alert alert-warn">{error}</div>;
  if (!data) return <Spinner />;
  const { solution, accusations, scores } = data;

  if (!solution) {
    return (
      <div className="card empty-state">
        <h3>Tävlingsläge: invänta avslöjandet</h3>
        <p className="muted">Alla spelares anklagelser är hemliga tills värden startar det gemensamma avslöjandet.</p>
        {roomState.membership.role === 'host' && (
          <button className="btn btn-primary" onClick={async () => { const d = await api.post(`/rooms/${roomId}/reveal`, {}); setData(d); }}>
            Starta avslöjande nu
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="card">
        <span className="stamp correct">Löst</span>
        <h1 style={{ marginTop: 12 }}>Den verkliga gärningspersonen: {solution.culprit.name}</h1>
        <h3>Motiv</h3>
        <p>{solution.motive}</p>
        <h3>Händelseförlopp</h3>
        <p>{solution.narrative}</p>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h2>Verklig tidslinje</h2>
          <div className="timeline">
            {solution.realTimeline.map((t, i) => (
              <div key={i} className="tl-item kind-confirmed">
                <span className="tl-time">{t.time}</span>
                <p className="small tight" style={{ marginTop: 2 }}>{t.text}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="stack">
          <div className="card">
            <h2>Avgörande bevis</h2>
            {solution.decisiveEvidence.map((e) => (
              <div key={e.id} className="finding" style={{ margin: 0, marginBottom: 8 }}>
                <strong>{e.title}</strong>
                <p className="small muted tight" style={{ marginTop: 4 }}>{e.meaning}</p>
              </div>
            ))}
          </div>
          <div className="card">
            <h2>Varför andra kunde verka skyldiga</h2>
            {solution.alternativeExplanations.map((a) => (
              <div key={a.person.personId} style={{ marginBottom: 12 }}>
                <div className="row"><Avatar name={a.person.name} initials={a.person.name.split(' ').map((w) => w[0]).join('')} color="#5b6b7d" size="sm" /><strong>{a.person.name}</strong></div>
                <p className="small muted tight" style={{ marginTop: 6 }}><strong>Tänkbart motiv:</strong> {a.whySeemedGuilty}</p>
                <p className="small tight" style={{ color: 'var(--green)' }}><strong>Utesluts av:</strong> {a.explanation}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {accusations?.length > 0 && (
        <div className="card">
          <h2>Allas anklagelser</h2>
          <div className="stack">
            {accusations.map((a) => (
              <div key={a.id} className="member-item">
                <div>
                  <strong>{a.displayName}</strong>
                  <p className="small faint tight">anklagade {a.suspectId}</p>
                </div>
                <span className="spacer" />
                <span className={`badge ${a.correct ? 'badge-green' : 'badge-red'}`}>{a.correct ? 'Korrekt' : 'Felaktig'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {scores?.length > 0 && (
        <div className="card">
          <h2>Slutställning</h2>
          {scores.map((s) => (
            <div key={s.user_id} className="row" style={{ justifyContent: 'space-between', padding: '6px 0' }}>
              <span>{s.display_name}</span>
              <strong>{s.total} poäng</strong>
            </div>
          ))}
        </div>
      )}
      {campaign && (
        <div className="alert alert-success">Kampanjsteg sparat i ”{campaign.title}”. Nästa kapitel finns under Kampanj.</div>
      )}
    </div>
  );
}
