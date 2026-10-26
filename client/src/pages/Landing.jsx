import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth-context.jsx';
import { WordmarkLanding } from '../components/Wordmark.jsx';

export function Landing() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', displayName: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const dest = location.state?.from || '/hem';

  const submit = async (e) => {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      if (mode === 'login') await login(form.username, form.password);
      else await register(form.username, form.displayName || form.username, form.password);
      navigate(dest, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="landing">
      <section className="landing-hero">
        <WordmarkLanding />
        <div>
          <h1 style={{ fontSize: '2rem', lineHeight: 1.2 }}>Lös svenska mordgåtor.<br />Sanningen ligger i detaljerna.</h1>
          <p className="landing-tagline">
            Samla bevis, förhör misstänkta, analysera tidslinjer och koppla ihop spåren på bevisbrädan –
            ensam eller tillsammans med vänner. AI-drivna förhör, men aldrig facit på köpet.
          </p>
          <div className="landing-badges">
            <span className="badge badge-red">Enspelare &amp; multiplayer</span>
            <span className="badge badge-blue">AI-förhör</span>
            <span className="badge badge-green">Hela grundspelet gratis</span>
          </div>
        </div>
        <p className="faint small tight">Demokonto: <strong>demo / demopass123</strong> · alla personer och platser är påhittade.</p>
      </section>
      <section className="landing-form">
        <form className="card" onSubmit={submit}>
          <div className="auth-switch" role="tablist" aria-label="Logga in eller skapa konto">
            <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Logga in</button>
            <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Skapa konto</button>
          </div>
          {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}
          <div className="field">
            <label htmlFor="username">Användarnamn</label>
            <input id="username" className="input" autoComplete="username" value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })} required minLength={3} />
          </div>
          {mode === 'register' && (
            <div className="field">
              <label htmlFor="displayName">Visningsnamn</label>
              <input id="displayName" className="input" value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
            </div>
          )}
          <div className="field">
            <label htmlFor="password">Lösenord (minst 8 tecken)</label>
            <input id="password" type="password" className="input" autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
          </div>
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Vänta…' : mode === 'login' ? 'Logga in' : 'Skapa konto'}</button>
          <p className="help-text" style={{ marginTop: 12 }}>
            Profiler är privata som standard. Inga betalväggar, inga köpta fördelar.
          </p>
        </form>
      </section>
    </div>
  );
}
