import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth-context.jsx';
import { Spinner, useToast } from '../components/ui.jsx';

const TOGGLES = [
  { key: 'narration', label: 'Berättarröst' },
  { key: 'music', label: 'Musik' },
  { key: 'sfx', label: 'Ljudeffekter' },
  { key: 'reducedMotion', label: 'Minskade animationer' },
  { key: 'highContrast', label: 'Förstärkt kontrast' },
];

export function SettingsPage() {
  const { user, refreshUser, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [settings, setSettings] = useState(null);
  const [profile, setProfile] = useState({ bio: '', isPrivate: true });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) {
      setSettings(user.settings || {});
      api.get('/auth/me').then((d) => setProfile({ bio: d.user.bio || '', isPrivate: d.user.isPrivate }));
    }
  }, [user]);

  if (!settings) return <Spinner />;

  const saveSettings = async (patch) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    await api.put('/auth/me/settings', patch);
    toast('Inställningar sparade', 'success');
  };

  const saveProfile = async () => {
    await api.put('/auth/me/profile', profile);
    await refreshUser();
    toast('Profil sparad', 'success');
  };

  const exportData = async () => {
    const d = await api.get('/auth/me/export');
    const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'mina-uppgifter-mordgatan.json'; a.click();
    URL.revokeObjectURL(url);
  };

  const deleteAccount = async () => {
    if (!confirm('Begär radering av ditt konto och alla dina uppgifter?')) return;
    setBusy(true);
    await api.post('/auth/me/delete-request', {});
    await logout();
    navigate('/');
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Profil &amp; inställningar</h1>
          <p>Privat profil som standard, separat styrning av ljud och presentation, och fullständig datakontroll.</p>
        </div>
      </div>

      <div className="grid grid-2">
        <section className="card stack">
          <h2>Profil</h2>
          <div className="field">
            <label htmlFor="bio">Presentation</label>
            <textarea id="bio" className="textarea" maxLength={500} value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} />
          </div>
          <label className="row small muted">
            <input type="checkbox" checked={profile.isPrivate} onChange={(e) => setProfile({ ...profile, isPrivate: e.target.checked })} />
            Privat profil (standard)
          </label>
          <button className="btn btn-primary" onClick={saveProfile}>Spara profil</button>
        </section>

        <section className="card stack">
          <h2>Ljud och tillgänglighet</h2>
          {TOGGLES.map((t) => (
            <label key={t.key} className="row" style={{ justifyContent: 'space-between' }}>
              <span>{t.label}</span>
              <Toggle on={!!settings[t.key]} onChange={(v) => saveSettings({ [t.key]: v })} />
            </label>
          ))}
          <div className="field">
            <label htmlFor="lang">Språk</label>
            <select id="lang" className="select" value={settings.language || 'sv'} onChange={(e) => saveSettings({ language: e.target.value })}>
              <option value="sv">Svenska</option>
              <option value="en">English (gränssnittet förblir tills vidare svenska)</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="pres">Presentation</label>
            <select id="pres" className="select" value={settings.presentation || 'text'} onChange={(e) => saveSettings({ presentation: e.target.value })}>
              <option value="text">Textbaserad</option>
              <option value="cinematic">Filmisk (webbläsarens berättarröst)</option>
            </select>
          </div>
        </section>

        <section className="card stack">
          <h2>Integritet och data</h2>
          <p className="small muted">Du kan exportera allt material kopplat till ditt konto, eller begära radering. Hemliga facit lagras aldrig på din enhet.</p>
          <button className="btn btn-subtle" onClick={exportData}>Ladda ner mina uppgifter (JSON)</button>
          <button className="btn btn-danger" disabled={busy} onClick={deleteAccount}>Begär radering av konto</button>
        </section>
      </div>
    </div>
  );
}

function Toggle({ on, onChange }) {
  return (
    <button type="button" role="switch" aria-checked={on} className={`switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)}>
      <span className="switch-knob" />
    </button>
  );
}
