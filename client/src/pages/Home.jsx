import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { CaseImage, DifficultyBadge, Spinner, Stars } from '../components/ui.jsx';
import { Icon } from '../components/Layout.jsx';

export function Home() {
  const [cases, setCases] = useState(null);
  const [sessions, setSessions] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/cases').then((d) => setCases(d.cases)).catch(() => setCases([]));
    api.get('/rooms/mine').then((d) => setSessions(d.sessions || [])).catch(() => {});
  }, []);

  const quickstart = async (difficulty) => {
    const d = await api.post('/rooms/quickstart', { difficulty });
    navigate(`/rum/${d.room.id}`);
  };

  if (!cases) return <Spinner />;
  const featured = cases[0];

  return (
    <div className="page">
      <section className="hero-banner">
        <span className="badge badge-red" style={{ marginBottom: 10 }}>Aktuellt fall</span>
        <h1>{featured?.title || 'Mordgåtan'}</h1>
        <p className="muted" style={{ maxWidth: 620 }}>{featured?.intro}</p>
        <div className="row-wrap" style={{ marginTop: 14 }}>
          <button className="btn btn-primary" onClick={() => quickstart()}><Icon name="search" size={16} /> Fortsätt direkt – snabbstart</button>
          <Link className="btn btn-ghost" to="/katalog">Läs mer</Link>
        </div>
      </section>

      <div className="quick-actions" style={{ marginBottom: 26 }}>
        <button className="card card-hover quick-action" onClick={() => navigate('/ny-utredning')}>
          <span className="iconbox"><Icon name="search" /></span>
          <h3>Snabbstart</h3>
          <p className="muted small tight">Låt systemet välja ett kvalitetssäkrat fall och starta direkt.</p>
          <span className="btn btn-primary btn-sm">Starta</span>
        </button>
        <button className="card card-hover quick-action" onClick={() => navigate('/kampanj')}>
          <span className="iconbox"><Icon name="book" /></span>
          <h3>Kampanj</h3>
          <p className="muted small tight">Flera fall i en sammanhängande berättelse.</p>
          <span className="btn btn-subtle btn-sm">Utforska</span>
        </button>
        <button className="card card-hover quick-action" onClick={() => navigate('/katalog')}>
          <span className="iconbox"><Icon name="grid" /></span>
          <h3>Fallkatalog</h3>
          <p className="muted small tight">Upptäck tusentals… färdiga och community-skapade fall.</p>
          <span className="btn btn-subtle btn-sm">Bläddra</span>
        </button>
      </div>

      <h2>Pågående och avslutade utredningar</h2>
      {sessions.length === 0 ? (
        <div className="card empty-state">
          <h3>Inga utredningar ännu</h3>
          <p className="muted">Starta din första från fallkatalogen eller med snabbstart.</p>
          <Link className="btn btn-primary" to="/katalog">Till fallkatalogen</Link>
        </div>
      ) : (
        <div className="grid grid-2">
          {sessions.map((s) => (
            <Link key={s.id} to={`/rum/${s.room_id}`} className="card card-hover" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <h3 className="tight">{s.title}</h3>
                {s.status === 'solved' ? <span className="badge badge-green">Löst</span>
                  : s.room_status === 'finished' ? <span className="badge">Avslutat</span>
                  : <span className="badge badge-blue">Pågående</span>}
              </div>
              <p className="faint small tight" style={{ marginTop: 8 }}>
                {s.mode === 'solo' ? 'Enspelarläge' : s.mode === 'cooperative' ? 'Samarbete' : 'Tävling'} · rum {s.code} · startad {new Date(s.started_at).toLocaleDateString('sv-SE')}
              </p>
            </Link>
          ))}
        </div>
      )}

      <h2 style={{ marginTop: 30 }}>Fler utvalda fall</h2>
      <div className="grid grid-3">
        {cases.slice(0, 6).map((c) => (
          <Link key={c.id} to={`/fall/${c.id}`} className="card card-hover case-card" style={{ textDecoration: 'none', color: 'inherit' }}>
            <CaseImage src={c.image} title={c.title} />
            <div className="case-body">
              <h3>{c.title}</h3>
              <p className="muted small tight">{c.intro}</p>
              <div className="case-meta">
                <DifficultyBadge id={c.difficulty} />
                <Stars value={c.ratingAvg} count={c.ratingCount} />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
