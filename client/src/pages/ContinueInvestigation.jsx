import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { EmptyState, Spinner } from '../components/ui.jsx';
import { ROOM_MODES } from '../../../shared/constants.js';

export function ContinueInvestigation() {
  const [sessions, setSessions] = useState(null);
  useEffect(() => { api.get('/rooms/mine').then((d) => setSessions(d.sessions)); }, []);
  if (!sessions) return <Spinner />;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Fortsätt utredning</h1>
          <p>Dina sessioner ligger kvar automatiskt – även efter avbrott och från andra enheter.</p>
        </div>
      </div>
      {sessions.length === 0 ? (
        <EmptyState title="Inga sparade utredningar" action={<Link className="btn btn-primary" to="/ny-utredning">Starta ny utredning</Link>} />
      ) : (
        <div className="grid grid-2">
          {sessions.map((s) => (
            <Link key={s.id} to={`/rum/${s.room_id}`} className="card card-hover" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <h3 className="tight">{s.title}</h3>
                {s.status === 'solved' ? <span className="badge badge-green">Löst</span>
                  : s.room_status === 'closed' ? <span className="badge">Stängt</span>
                  : <span className="badge badge-blue">Pågående</span>}
              </div>
              <p className="faint small" style={{ margin: '8px 0 0' }}>
                {ROOM_MODES[s.mode]} · rumskod {s.code} · startad {new Date(s.started_at).toLocaleString('sv-SE')}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
