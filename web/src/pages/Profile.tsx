import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError, setCsrfToken } from '../api';
import { useAuth } from '../auth';
import { useDocumentTitle } from '../hooks';
import { useToast } from '../toast';
import { formatDate, formatSek, initials } from '../format';
import { Icon } from '../components/Icon';
import {
  Banner,
  Button,
  ConfirmDialog,
  Modal,
  Pill,
  SelectField,
  Skeleton,
  TextField,
  Toggle,
} from '../components/UI';

const TIMEZONES = [
  'Europe/Stockholm',
  'Europe/Oslo',
  'Europe/Copenhagen',
  'Europe/Helsinki',
  'Europe/London',
  'Europe/Berlin',
  'UTC',
];

export function Profile() {
  useDocumentTitle('Profil och integritet');
  const { user, stats, refresh, setUser, logout } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();

  const [alias, setAlias] = useState(user?.profile.alias ?? '');
  const [timezone, setTimezone] = useState(user?.profile.timezone ?? 'Europe/Stockholm');
  const [savingAlias, setSavingAlias] = useState(false);
  const [aliasError, setAliasError] = useState<string | null>(null);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  const [deleting, setDeleting] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);

  useEffect(() => {
    if (!user) return;
    setAlias(user.profile.alias);
    setTimezone(user.profile.timezone);
  }, [user]);

  if (!user) {
    return (
      <div className="stack">
        <Skeleton hero lines={3} />
      </div>
    );
  }

  const saveAlias = async (event: FormEvent) => {
    event.preventDefault();
    setAliasError(null);
    setSavingAlias(true);
    try {
      const result = await api.updateProfile({ alias: alias.trim(), timezone });
      setUser(result.user);
      push('Profilen är uppdaterad.');
      void refresh();
    } catch (error) {
      setAliasError(error instanceof ApiError ? error.message : 'Kunde inte spara profilen.');
    } finally {
      setSavingAlias(false);
    }
  };

  const toggle = async (key: 'publicCompetitionConsent' | 'shareBadges', value: boolean) => {
    setTogglingKey(key);
    const previous = user;
    setUser({
      ...user,
      profile: { ...user.profile, [key]: value },
    });
    try {
      const result = await api.updateProfile({ [key]: value });
      setUser(result.user);
      push(
        key === 'publicCompetitionConsent'
          ? value
            ? 'Du kan nu delta i offentliga tävlingar.'
            : 'Offentliga tävlingar är avstängda. Du kan fortfarande tävla i grupper.'
          : value
            ? 'Dina bedriftsmärken visas på topplistor.'
            : 'Dina bedriftsmärken visas inte längre på topplistor.',
        'info',
      );
      void refresh();
    } catch (error) {
      setUser(previous);
      push(error instanceof ApiError ? error.message : 'Kunde inte spara inställningen.', 'error');
    } finally {
      setTogglingKey(null);
    }
  };

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    setPasswordError(null);
    if (newPassword !== confirmPassword) {
      setPasswordError('De nya lösenorden matchar inte.');
      return;
    }
    setSavingPassword(true);
    try {
      const result = await api.changePassword(currentPassword, newPassword);
      setCsrfToken(result.csrfToken);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      push('Lösenordet är bytt. Dina andra sessioner är utloggade.');
    } catch (error) {
      setPasswordError(error instanceof ApiError ? error.message : 'Kunde inte byta lösenord.');
    } finally {
      setSavingPassword(false);
    }
  };

  const deleteAccount = async () => {
    setDeleteError(null);
    setBusyDelete(true);
    try {
      await api.deleteAccount(deletePassword, deleteConfirm);
      await logout();
      navigate('/logga-in', { replace: true });
      push('Ditt konto och all finansiell data har raderats.', 'info');
    } catch (error) {
      setDeleteError(error instanceof ApiError ? error.message : 'Kunde inte radera kontot.');
    } finally {
      setBusyDelete(false);
    }
  };

  const level = stats?.level;

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1 className="page-head__title">Profil och integritet</h1>
          <p className="page-head__subtitle">Du bestämmer vad andra ser. Ekonomin är alltid privat.</p>
        </div>
      </header>

      <section className="profile-head" aria-labelledby="profile-name">
        <span className="avatar avatar--lg" aria-hidden="true">
          {initials(user.profile.alias)}
        </span>
        <div className="profile-head__body">
          <h2 className="profile-head__name" id="profile-name">
            {user.profile.alias}
          </h2>
          <p className="profile-head__email">{user.email}</p>
          <div className="profile-head__meta">
            <Pill tone="gold">
              Nivå {level?.level ?? 1} · {level?.name ?? 'Nybörjare'}
            </Pill>
            <Pill tone="neutral">Medlem sedan {formatDate(user.createdAt, user.profile.timezone)}</Pill>
            <Pill tone={user.profile.publicCompetitionConsent ? 'emerald' : 'neutral'}>
              {user.profile.publicCompetitionConsent ? 'Offentliga tävlingar på' : 'Offentliga tävlingar av'}
            </Pill>
          </div>
        </div>
      </section>

      {stats ? (
        <div className="stats-row">
          <div className="stat-tile">
            <span className="stat-tile__label">Sparat</span>
            <span className="stat-tile__value">{formatSek(stats.totalSavedOre)}</span>
            <span className="stat-tile__meta">{stats.activeGoalCount} aktiva mål</span>
          </div>
          <div className="stat-tile">
            <span className="stat-tile__label">Bedrifter</span>
            <span className="stat-tile__value">{stats.achievementCount}</span>
            <span className="stat-tile__meta">nivå {stats.level.level}</span>
          </div>
          <div className="stat-tile">
            <span className="stat-tile__label">Tävlingar</span>
            <span className="stat-tile__value">{stats.competitionCount}</span>
            <span className="stat-tile__meta">aktiva deltaganden</span>
          </div>
        </div>
      ) : null}

      <div className="settings-layout">
        <div className="stack">
          <section className="settings-card" aria-labelledby="alias-title">
            <div className="settings-section-head">
              <span className="settings-section-head__icon">
                <Icon name="user" size={18} />
              </span>
              <div>
                <h2 id="alias-title">Alias och tidszon</h2>
                <p>Aliaset är det enda andra ser. Ditt riktiga namn och din e-post är alltid privata.</p>
              </div>
            </div>
            <form className="profile-form" onSubmit={saveAlias} noValidate>
              {aliasError ? (
                <div className="banner banner--error" role="alert">
                  <span className="banner__icon">!</span>
                  <div>{aliasError}</div>
                </div>
              ) : null}
              <TextField
                label="Alias"
                value={alias}
                onChange={(event) => setAlias(event.target.value)}
                maxLength={24}
                minLength={3}
                required
                hint="3–24 tecken. Bokstäver, siffror, punkt, bindestreck och understreck."
              />
              <SelectField label="Tidszon" value={timezone} onChange={(event) => setTimezone(event.target.value)}>
                {[...new Set([timezone, ...TIMEZONES])].map((zone) => (
                  <option key={zone} value={zone}>
                    {zone.replace('_', ' ')}
                  </option>
                ))}
              </SelectField>
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <Button type="submit" loading={savingAlias}>
                  Spara profil
                </Button>
              </div>
            </form>
          </section>

          <section className="settings-card" aria-labelledby="security-title">
            <div className="settings-section-head">
              <span className="settings-section-head__icon">
                <Icon name="shield" size={18} />
              </span>
              <div>
                <h2 id="security-title">Kontosäkerhet</h2>
                <p>Byt lösenord. Alla andra sessioner loggas ut när du byter.</p>
              </div>
            </div>
            <form className="profile-form" onSubmit={changePassword} noValidate>
              {passwordError ? (
                <div className="banner banner--error" role="alert">
                  <span className="banner__icon">!</span>
                  <div>{passwordError}</div>
                </div>
              ) : null}
              <TextField
                label="Nuvarande lösenord"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
              <TextField
                label="Nytt lösenord"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
                hint="Minst 10 tecken med både bokstäver och siffror."
              />
              <TextField
                label="Bekräfta nytt lösenord"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <Button type="submit" loading={savingPassword}>
                  Byt lösenord
                </Button>
              </div>
            </form>
          </section>

          <section className="danger-zone" aria-labelledby="danger-title">
            <h2 id="danger-title">Radera konto</h2>
            <p>
              Ditt konto och all finansiell data raderas omedelbart och kan inte återskapas: sparmål, sparhistorik,
              transaktioner, bedrifter och sessioner. Om du äger en grupp flyttas ägarskapet till nästa medlem, annars tas
              gruppen bort. Säkerhetsloggen behåller en pseudonym händelse utan e-post eller alias.
            </p>
            <div className="row wrap">
              <Button variant="danger" icon="trash" onClick={() => setDeleting(true)}>
                Radera mitt konto
              </Button>
              <Button
                variant="secondary"
                icon="logout"
                onClick={async () => {
                  await logout();
                  navigate('/logga-in', { replace: true });
                }}
              >
                Logga ut
              </Button>
            </div>
          </section>
        </div>

        <div className="stack">
          <section className="settings-card" aria-labelledby="privacy-title">
            <div className="settings-section-head">
              <span className="settings-section-head__icon">
                <Icon name="eye" size={18} />
              </span>
              <div>
                <h2 id="privacy-title">Sekretessinställningar</h2>
                <p>Deltagande i offentliga tävlingar är alltid avstängt tills du själv slår på det.</p>
              </div>
            </div>
            <div style={{ padding: '4px 0 12px' }}>
              <Toggle
                checked={user.profile.publicCompetitionConsent}
                disabled={togglingKey === 'publicCompetitionConsent'}
                onChange={(value) => toggle('publicCompetitionConsent', value)}
                label="Delta i offentliga tävlingar"
                description="När det är på kan du gå med i öppna 7- och 30-dagars tävlingar. Andra ser då ditt alias, poäng och placering."
              />
              <Toggle
                checked={user.profile.shareBadges}
                disabled={togglingKey === 'shareBadges'}
                onChange={(value) => toggle('shareBadges', value)}
                label="Visa bedriftsmärken på topplistor"
                description="Ett litet märke bredvid ditt alias. Inga belopp eller mål visas oavsett inställning."
              />
            </div>
            <Banner tone="info" title="Det här delas aldrig" icon="lock">
              Saldon, målbelopp, inkomster, utgifter, transaktioner och privata mål visas aldrig för andra – inte ens i
              grupper eller topplistor.
            </Banner>
          </section>

          <section className="settings-card" aria-labelledby="account-title">
            <div className="settings-section-head">
              <span className="settings-section-head__icon">
                <Icon name="calendar" size={18} />
              </span>
              <div>
                <h2 id="account-title">Konto</h2>
                <p>Kontouppgifter och inloggning.</p>
              </div>
            </div>
            <div className="profile-form" style={{ gap: 10 }}>
              <div className="row row--between small">
                <span className="muted">E-post</span>
                <span>{user.email}</span>
              </div>
              <div className="row row--between small">
                <span className="muted">Konto-ID</span>
                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.72rem' }}>{user.id.slice(0, 8)}…</span>
              </div>
              <div className="row row--between small">
                <span className="muted">Skapat</span>
                <span>{formatDate(user.createdAt, user.profile.timezone)}</span>
              </div>
              <div className="row row--between small">
                <span className="muted">Session</span>
                <span>Serverhanterad, HttpOnly-cookie</span>
              </div>
            </div>
          </section>
        </div>
      </div>

      <Modal
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Radera kontot permanent"
        description="Åtgärden kan inte ångras. All finansiell data raderas direkt."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(false)}>
              Avbryt
            </Button>
            <Button
              variant="danger"
              loading={busyDelete}
              disabled={deleteConfirm !== 'RADERA' || deletePassword.length === 0}
              onClick={deleteAccount}
            >
              Radera kontot
            </Button>
          </>
        }
      >
        <div className="stack">
          {deleteError ? (
            <Banner tone="error" title="Kunde inte radera kontot" icon="info">
              {deleteError}
            </Banner>
          ) : null}
          <TextField
            label="Bekräfta med ditt lösenord"
            type="password"
            autoComplete="current-password"
            value={deletePassword}
            onChange={(event) => setDeletePassword(event.target.value)}
            required
          />
          <TextField
            label="Skriv RADERA för att bekräfta"
            value={deleteConfirm}
            onChange={(event) => setDeleteConfirm(event.target.value.toUpperCase())}
            placeholder="RADERA"
            required
          />
          <Banner tone="warning" title="Detta raderas" icon="trash">
            Alla sparmål, insättningar, uttag, transaktioner, bedrifter och sessioner. Ditt alias blir ledigt igen.
          </Banner>
        </div>
      </Modal>

    </>
  );
}
