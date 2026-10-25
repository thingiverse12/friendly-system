import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { useAsync, useDocumentTitle } from '../hooks';
import { useToast } from '../toast';
import { formatDateTime, formatSek, timeLeft } from '../format';
import { JoinCompetitionModal } from '../components/JoinCompetitionModal';
import { Icon } from '../components/Icon';
import {
  Banner,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Pill,
  Segmented,
  Skeleton,
} from '../components/UI';
import type { CompetitionDetail as CompetitionDetailData, Goal } from '../types';

export function CompetitionDetail() {
  const { competitionId = '' } = useParams();
  const { user } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const state = useAsync<CompetitionDetailData>(async () => api.competition(competitionId), [competitionId]);
  const goalsState = useAsync<{ goals: Goal[]; totals: { savedOre: number; targetOre: number } }>(
    async () => api.goals(false),
    [],
  );
  const [joining, setJoining] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [classFilter, setClassFilter] = useState<string>('all');

  const detail = state.data;
  useDocumentTitle(detail?.competition.name ?? 'Tävling');

  const entries = detail?.leaderboard.entries ?? [];
  const classes = useMemo(() => [...new Set(entries.map((entry) => entry.classCode).filter(Boolean))], [entries]);
  const visibleEntries = classFilter === 'all' ? entries : entries.filter((entry) => entry.classCode === classFilter);
  const goals = goalsState.data?.goals ?? [];

  const reload = () => {
    state.reload();
    goalsState.reload();
  };

  const withdraw = async () => {
    setBusy(true);
    try {
      await api.withdrawCompetition(competitionId);
      push('Du har lämnat tävlingen. Ditt sparande finns kvar som vanligt.', 'info');
      setWithdrawing(false);
      reload();
    } catch (error) {
      push((error as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (state.loading) return <Skeleton hero lines={5} />;
  if (state.error) {
    if (state.error.status === 404) {
      return (
        <div className="card">
          <EmptyState
            variant="trophy"
            title="Tävlingen hittades inte"
            description="Den kan ha avslutats och rensats, eller tillhöra en grupp du inte är med i."
            action={<Button onClick={() => navigate('/tavlingar')}>Till tävlingar</Button>}
          />
        </div>
      );
    }
    return <ErrorState message={state.error.message} onRetry={state.reload} />;
  }
  if (!detail) return null;

  const { competition, myParticipation } = detail;
  const completed = competition.status === 'completed';
  const consent = user?.profile.publicCompetitionConsent ?? false;
  const canJoin =
    !myParticipation.joined &&
    !completed &&
    competition.status !== 'cancelled' &&
    (competition.visibility === 'private' || consent);

  return (
    <>
      <div className="row" style={{ gap: 8 }}>
        <Link to="/tavlingar" className="btn btn--ghost btn--sm">
          <Icon name="chevronLeft" size={16} /> Alla tävlingar
        </Link>
      </div>

      <section className="competition-hero" aria-labelledby="competition-title">
        <div className="competition-hero__top">
          <Pill tone="gold">{competition.durationDays} dagar</Pill>
          <Pill tone="emerald">{competition.visibility === 'public' ? 'Offentlig' : 'Privat grupp'}</Pill>
          <Pill tone={completed ? 'neutral' : 'navy'}>
            {completed ? 'Avslutad' : competition.status === 'upcoming' ? 'Startar snart' : 'Pågår'}
          </Pill>
        </div>
        <h1 className="competition-hero__title" id="competition-title">
          {competition.name}
        </h1>
        <p className="competition-hero__desc">{competition.description}</p>
        <div className="competition-hero__meta">
          <span>
            Start
            <strong>{formatDateTime(competition.startsAt, user?.profile.timezone)}</strong>
          </span>
          <span>
            Slut
            <strong>{formatDateTime(competition.endsAt, user?.profile.timezone)}</strong>
          </span>
          <span>
            Deltagare
            <strong>{competition.participantCount}</strong>
          </span>
          <span>
            {completed ? 'Resultat' : 'Kvar'}
            <strong>{completed ? 'Låst' : timeLeft(competition.endsAt)}</strong>
          </span>
        </div>

        {myParticipation.joined ? (
          <dl className="my-score-card" style={{ marginTop: 18 }}>
            <div>
              <dt>Din poäng</dt>
              <dd>{myParticipation.score !== null ? myParticipation.score.toFixed(1).replace('.', ',') : '—'}</dd>
            </div>
            <div>
              <dt>Placering</dt>
              <dd>{myParticipation.rank ? `#${myParticipation.rank}` : '—'}</dd>
            </div>
            <div>
              <dt>Klass</dt>
              <dd>{myParticipation.classCode ?? '—'}</dd>
            </div>
          </dl>
        ) : null}

        <div className="row wrap" style={{ marginTop: 16, gap: 10 }}>
          {canJoin ? (
            <Button icon="trophy" onClick={() => setJoining(true)}>
              Gå med
            </Button>
          ) : null}
          {!myParticipation.joined && competition.visibility === 'public' && !consent && !completed ? (
            <Link to="/profil" className="btn btn--secondary">
              Godkänn offentliga tävlingar
            </Link>
          ) : null}
          {myParticipation.joined && !completed ? (
            <Button variant="secondary" onClick={() => setWithdrawing(true)}>
              Lämna tävlingen
            </Button>
          ) : null}
          {myParticipation.joined && myParticipation.goalId ? (
            <Link to={`/mal/${myParticipation.goalId}`} className="btn btn--secondary">
              Till sparmålet
            </Link>
          ) : null}
        </div>
      </section>

      {completed ? (
        <Banner tone="success" title="Tävlingen är avslutad" icon="check">
          Slutresultatet beräknades av servern när tävlingen tog slut och är nu låst. Resultatet kan inte ändras i
          efterhand.
        </Banner>
      ) : null}

      {myParticipation.snapshotFrozen && myParticipation.startingBalanceOre !== null ? (
        <section className="card card--pad stack" aria-labelledby="my-participation">
          <h2 id="my-participation" className="section-header__title">
            Ditt utgångsläge
          </h2>
          <div className="summary-grid">
            <div className="summary-tile">
              <span className="summary-tile__label">Startsaldo</span>
              <span className="summary-tile__value">{formatSek(myParticipation.startingBalanceOre)}</span>
            </div>
            <div className="summary-tile">
              <span className="summary-tile__label">Låst mål</span>
              <span className="summary-tile__value">{formatSek(myParticipation.lockedTargetOre ?? 0)}</span>
            </div>
            <div className="summary-tile">
              <span className="summary-tile__label">Klass</span>
              <span className="summary-tile__value">{myParticipation.classCode ?? '—'}</span>
            </div>
          </div>
          <p className="small muted">
            {myParticipation.classLabel ?? ''} Dessa värden är låsta sedan starten och kan inte ändras. Endast du ser dina
            egna belopp.
          </p>
        </section>
      ) : myParticipation.joined && competition.status === 'upcoming' ? (
        <Banner tone="info" title="Du är anmäld" icon="clock">
          Startsaldot låses när tävlingen startar. Fram till dess kan du fortsätta spara som vanligt.
        </Banner>
      ) : null}

      <section className="section" aria-labelledby="leaderboard-title">
        <div className="row row--between wrap">
          <h2 id="leaderboard-title" className="section-header__title">
            Topplista
          </h2>
          {classes.length > 1 ? (
            <Segmented
              label="Filtrera klass"
              value={classFilter}
              onChange={setClassFilter}
              options={[
                { value: 'all', label: 'Alla' },
                ...classes.map((code) => ({ value: code, label: `Klass ${code}` })),
              ]}
            />
          ) : null}
        </div>

        {visibleEntries.length === 0 ? (
          <div className="card">
            <EmptyState
              variant="trophy"
              title={competition.status === 'upcoming' ? 'Topplistan öppnar vid start' : 'Inga deltagare än'}
              description="Bli först att gå med – poängen räknas från det att tävlingen startar."
            />
          </div>
        ) : (
          <div className="card" style={{ padding: '12px 10px' }}>
            <table className="leaderboard">
              <caption>
                Endast alias, placering, poäng och godkända bedriftsmärken visas. Deltagare med lika poäng delar placering.
              </caption>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Alias</th>
                  <th scope="col">Poäng</th>
                </tr>
              </thead>
              <tbody>
                {visibleEntries.map((entry) => (
                  <tr key={`${entry.alias}-${entry.rank}`} className={entry.isYou ? 'is-you' : undefined}>
                    <td>
                      <span className={`rank ${entry.rank && entry.rank <= 3 ? `rank--${entry.rank}` : ''}`}>
                        {entry.rank ?? '–'}
                      </span>
                    </td>
                    <td>
                      <span className="leaderboard__alias">
                        <span aria-hidden="true">{entry.badge ? entry.badge : '👤'}</span>
                        {entry.alias}
                        {entry.isYou ? <small>Du</small> : null}
                        {entry.classCode ? <small>Klass {entry.classCode}</small> : null}
                      </span>
                    </td>
                    <td>
                      <span className={`leaderboard__score ${entry.score < 0 ? 'leaderboard__score--negative' : ''}`}>
                        {entry.score.toFixed(1).replace('.', ',')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="score-explainer">
        <Icon name="info" size={18} />
        <div>
          <strong>Poängformel:</strong> <code>{competition.scoringFormula}</code>
          <p style={{ marginTop: 6 }}>{detail.classExplanation}</p>
          <p style={{ marginTop: 6 }}>
            Poängen beräknas alltid på servern utifrån dina bokförda sparhändelser. Nedladdningar, betalda funktioner eller
            manuella inmatningar kan aldrig höja poängen.
          </p>
        </div>
      </div>

      {joining ? (
        <JoinCompetitionModal
          open
          competitionId={competition.id}
          competitionName={competition.name}
          goals={goals}
          onClose={() => setJoining(false)}
          onJoined={() => {
            setJoining(false);
            reload();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={withdrawing}
        title="Lämna tävlingen?"
        message="Du tas bort från topplistan och kan inte gå med igen i samma tävling. Ditt sparande påverkas inte."
        confirmLabel="Lämna"
        danger
        loading={busy}
        onConfirm={withdraw}
        onCancel={() => setWithdrawing(false)}
      />
    </>
  );
}
