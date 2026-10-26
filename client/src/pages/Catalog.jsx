import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { CaseImage, DifficultyBadge, Stars, EmptyState } from '../components/ui.jsx';
import { CASE_TYPES, ENVIRONMENTS, DIFFICULTIES } from '../../../shared/constants.js';

export function Catalog() {
  const [cases, setCases] = useState([]);
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [env, setEnv] = useState('');
  const [diff, setDiff] = useState('');
  const [sort, setSort] = useState('popular');

  const load = () => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (type) params.set('type', type);
    if (env) params.set('environment', env);
    if (diff) params.set('difficulty', diff);
    params.set('sort', sort);
    api.get(`/cases?${params}`).then((d) => setCases(d.cases));
  };
  useEffect(load, [type, env, diff, sort]);

  const debounce = useMemo(() => {
    let t;
    return (fn) => { clearTimeout(t); t = setTimeout(fn, 350); };
  }, []);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Fallkatalog</h1>
          <p>Sök och filtrera bland godkända, spoilerfria fall. Facit finns aldrig i katalogen.</p>
        </div>
      </div>

      <div className="filterbar" role="search">
        <input className="input search" type="search" placeholder="Sök fall…" aria-label="Sök fall"
          value={q} onChange={(e) => { setQ(e.target.value); debounce(load); }} />
        <select className="select" value={type} onChange={(e) => setType(e.target.value)} aria-label="Falltyp">
          <option value="">Alla typer</option>
          {Object.entries(CASE_TYPES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
        <select className="select" value={env} onChange={(e) => setEnv(e.target.value)} aria-label="Miljö">
          <option value="">Alla miljöer</option>
          {Object.entries(ENVIRONMENTS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
        <select className="select" value={diff} onChange={(e) => setDiff(e.target.value)} aria-label="Svårighetsgrad">
          <option value="">Alla svårighetsgrader</option>
          {Object.entries(DIFFICULTIES).map(([id, d]) => <option key={id} value={id}>{d.label}</option>)}
        </select>
        <select className="select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sortering">
          <option value="popular">Populärast</option>
          <option value="rating">Högst betyg</option>
          <option value="newest">Nyast</option>
        </select>
      </div>

      {cases.length === 0 ? (
        <EmptyState title="Inga fall matchar filtren">Prova att ta bort ett filter eller sök på något annat.</EmptyState>
      ) : (
        <div className="grid grid-3">
          {cases.map((c) => (
            <Link key={c.id} to={`/fall/${c.id}`} className="card card-hover case-card" style={{ textDecoration: 'none', color: 'inherit' }}>
              <CaseImage src={c.image} title={c.title} />
              <div className="case-body">
                <div className="row-wrap">
                  {c.official && <span className="badge badge-blue">Officiellt</span>}
                  <DifficultyBadge id={c.difficulty} />
                </div>
                <h3>{c.title}</h3>
                <p className="muted small tight">{c.intro}</p>
                <p className="faint small tight">{CASE_TYPES[c.caseType]} · {ENVIRONMENTS[c.environment]} · ca {c.playtimeMin} min</p>
                <div className="case-meta">
                  <Stars value={c.ratingAvg} count={c.ratingCount} />
                  <span className="faint small">v{c.version}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
