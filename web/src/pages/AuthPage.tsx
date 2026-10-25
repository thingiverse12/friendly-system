import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../api';
import { useAuth } from '../auth';
import { useToast } from '../toast';
import { FjordScene, Logo } from '../components/Illustrations';
import { Banner, Button, TextField } from '../components/UI';
import { Icon } from '../components/Icon';

type Mode = 'login' | 'register' | 'forgot' | 'reset';

const COPY: Record<Mode, { title: string; lead: string; submit: string }> = {
  login: { title: 'Välkommen tillbaka', lead: 'Logga in för att fortsätta mot dina mål.', submit: 'Logga in' },
  register: { title: 'Skapa konto', lead: 'Bli en del av Sparly. Det tar bara en minut.', submit: 'Skapa konto' },
  forgot: {
    title: 'Återställ lösenord',
    lead: 'Ange din e-postadress så skickar vi en länk för att välja ett nytt lösenord.',
    submit: 'Skicka länk',
  },
  reset: { title: 'Välj nytt lösenord', lead: 'Ange ett nytt lösenord för ditt konto.', submit: 'Spara nytt lösenord' },
};

export function AuthPage({ mode }: { mode: Mode }) {
  const { status, login, register, requestPasswordReset, updatePassword, configured } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { push } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [alias, setAlias] = useState('');
  const [consent, setConsent] = useState(false);
  const [terms, setTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [awaitingVerification, setAwaitingVerification] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const from = (location.state as { from?: string } | null)?.from;

  useEffect(() => {
    setError(null);
    setFieldErrors({});
    setNotice(null);
    setAwaitingVerification(null);
    setPassword('');
    setConfirmPassword('');
  }, [mode]);

  if (status === 'auth' && mode !== 'reset') {
    return <Navigate to={from && from !== '/logga-in' ? from : '/'} replace />;
  }

  const capture = (caught: unknown) => {
    if (caught instanceof ApiError) {
      setError(caught.message);
      const next: Record<string, string> = {};
      for (const issue of caught.issues) next[issue.field] = issue.message;
      setFieldErrors(next);
    } else {
      setError('Något gick fel. Försök igen.');
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(email.trim(), password);
        push('Inloggad. Välkommen tillbaka!', 'success');
        navigate(from && from !== '/logga-in' ? from : '/', { replace: true });
      } else if (mode === 'register') {
        if (!terms) {
          setError('Du behöver godkänna villkoren för att skapa ett konto.');
          return;
        }
        if (password !== confirmPassword) {
          setFieldErrors({ confirmPassword: 'Lösenorden matchar inte.' });
          setError('Lösenorden matchar inte.');
          return;
        }
        const outcome = await register({
          email: email.trim(),
          password,
          ...(alias.trim() ? { alias: alias.trim() } : {}),
          publicCompetitionConsent: consent,
        });
        if (outcome === 'verify-email') {
          setAwaitingVerification(email.trim());
          setNotice(null);
        } else {
          push('Konto skapat. Välkommen till Sparly!', 'success');
          navigate('/', { replace: true });
        }
      } else if (mode === 'forgot') {
        setNotice(await requestPasswordReset(email.trim()));
      } else {
        if (password !== confirmPassword) {
          setFieldErrors({ confirmPassword: 'Lösenorden matchar inte.' });
          setError('Lösenorden matchar inte.');
          return;
        }
        await updatePassword(password);
        setNotice('Lösenordet är uppdaterat. Du kan fortsätta till din översikt.');
        push('Lösenordet är uppdaterat.', 'success');
        window.setTimeout(() => navigate('/', { replace: true }), 1200);
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Något gick fel. Försök igen.';
      if (caught instanceof ApiError) {
        capture(caught);
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  };

  const copy = COPY[mode];

  return (
    <div className="auth">
      <section className="auth__hero" aria-label="Sparly">
        <FjordScene className="auth__scene" variant="night" />
        <div style={{ position: 'relative', zIndex: 2 }}>
          <Logo light />
        </div>
        <div className="auth__hero-content">
          <p className="auth__tagline">Små steg. Stora mål.</p>
          <p className="auth__sub">Spara smartare, tävla vänskapligt och fira varje milstolpe tillsammans.</p>
          <span className="pill pill--gold auth__badge">🏆 Nivåer &amp; bedrifter</span>
        </div>
      </section>

      <section className="auth__panel">
        <div className="auth__card">
          <div>
            <h1 className="auth__title">{copy.title}</h1>
            <p className="auth__lead">{copy.lead}</p>
          </div>

          {!configured ? (
            <Banner tone="warning" title="Inloggningen saknar konfiguration" icon="shield">
              Sätt VITE_SUPABASE_URL och VITE_SUPABASE_ANON_KEY för den här miljön, bygg om webben och ladda sidan igen.
            </Banner>
          ) : null}

          {notice ? (
            <Banner tone="success" title="Klart" icon="check">
              {notice}
            </Banner>
          ) : null}

          {error ? (
            <div className="banner banner--error" role="alert">
              <span className="banner__icon">!</span>
              <div>{error}</div>
            </div>
          ) : null}

          {awaitingVerification ? (
            <div className="stack">
              <Banner tone="success" title="Bekräfta din e-post" icon="check">
                Vi har skickat en bekräftelselänk till <strong>{awaitingVerification}</strong>. Öppna länken i mejlet för
                att aktivera kontot — sedan kan du logga in här.
              </Banner>
              <Button variant="primary" className="btn--block" onClick={() => navigate('/logga-in', { replace: true })}>
                Till inloggningen
              </Button>
            </div>
          ) : (
          <form className="auth__form" onSubmit={onSubmit} noValidate>
            {mode !== 'reset' ? (
              <TextField
                label="E-postadress"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="namn@exempel.se"
                required
                error={fieldErrors.email}
              />
            ) : null}

            {mode !== 'forgot' ? (
              <>
                <div className="field">
                  <label className="field__label" htmlFor="password">
                    {mode === 'reset' ? 'Nytt lösenord' : 'Lösenord'}
                    <span className="field__required"> *</span>
                  </label>
                  <div className="password-wrap">
                    <input
                      id="password"
                      className="input"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder={mode === 'login' ? 'Ditt lösenord' : 'Minst 10 tecken, bokstäver och siffror'}
                      required
                      aria-invalid={Boolean(fieldErrors.password)}
                    />
                    <button
                      type="button"
                      className="password-wrap__toggle"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? 'Dölj lösenord' : 'Visa lösenord'}
                      aria-pressed={showPassword}
                    >
                      <Icon name="eye" size={18} />
                    </button>
                  </div>
                  {fieldErrors.password ? (
                    <p className="field__error" role="alert">
                      {fieldErrors.password}
                    </p>
                  ) : null}
                </div>

                {mode === 'register' || mode === 'reset' ? (
                  <TextField
                    label="Bekräfta lösenord"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Skriv lösenordet igen"
                    required
                    error={fieldErrors.confirmPassword}
                  />
                ) : null}
              </>
            ) : null}

            {mode === 'register' ? (
              <>
                <TextField
                  label="Alias"
                  optionalLabel="(valfritt)"
                  value={alias}
                  onChange={(event) => setAlias(event.target.value)}
                  placeholder="till exempel sparlygd_emma"
                  maxLength={24}
                  hint="Ditt alias är det enda andra ser. Vi föreslår ett om du lämnar fältet tomt."
                  error={fieldErrors.alias}
                  autoComplete="username"
                />
                <label className="checkbox">
                  <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
                  <span>
                    Jag vill kunna delta i offentliga spartävlingar. Du kan ändra detta när som helst under Profil och
                    integritet.
                  </span>
                </label>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={terms}
                    onChange={(event) => setTerms(event.target.checked)}
                    required
                    aria-invalid={Boolean(fieldErrors.acceptedTerms)}
                  />
                  <span>
                    Jag godkänner användarvillkoren och integritetspolicyn. Jag förstår att Sparly inte flyttar pengar, utan
                    hjälper mig hålla koll på mitt eget sparande.
                  </span>
                </label>
                {fieldErrors.acceptedTerms ? (
                  <p className="field__error" role="alert">
                    {fieldErrors.acceptedTerms}
                  </p>
                ) : null}
              </>
            ) : null}

            {mode === 'login' ? (
              <div className="row row--between">
                <Link to="/glomt-losenord" className="small">
                  Glömt lösenord?
                </Link>
              </div>
            ) : null}

            <Button type="submit" variant="primary" className="btn--block" loading={busy}>
              {copy.submit}
            </Button>
          </form>
          )}

          {mode === 'login' ? (
            <p className="auth__alt">
              Har du inget konto? <Link to="/skapa-konto">Skapa konto</Link>
            </p>
          ) : null}
          {mode === 'register' ? (
            <p className="auth__alt">
              Har du redan ett konto? <Link to="/logga-in">Logga in</Link>
            </p>
          ) : null}
          {mode === 'forgot' || mode === 'reset' ? (
            <p className="auth__alt">
              <Link to="/logga-in">Tillbaka till inloggning</Link>
            </p>
          ) : null}
          <p className="auth__fineprint">
            Sparly är en app för att planera och följa upp sparande. Vi hanterar inga riktiga betalningar och ser aldrig dina
            bankuppgifter.
          </p>
        </div>
      </section>
    </div>
  );
}
