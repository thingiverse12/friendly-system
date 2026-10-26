import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { useAsync, useDocumentTitle } from '../hooks';
import { useToast } from '../toast';
import { formatDateTime, formatSek } from '../format';
import { GoalHero, MilestoneList } from '../components/Cards';
import { GoalForm, MovementForm } from '../components/Forms';
import { GoalCelebration, forgetCelebrated, hasCelebrated, isGoalComplete } from '../components/Celebration';
import { Icon } from '../components/Icon';
import {
  Banner,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Modal,
  Pill,
  ProgressBar,
  SectionHeader,
  Skeleton,
} from '../components/UI';
import type { Goal, GoalDetailResponse } from '../types';

export function GoalDetail() {
  const { goalId = '' } = useParams();
  const { user, refresh } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const state = useAsync<GoalDetailResponse>(async () => api.goal(goalId), [goalId]);
  const [movement, setMovement] = useState<'deposit' | 'withdrawal' | null>(null);
  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [celebrating, setCelebrating] = useState(false);

  const goal = state.data?.goal;
  useDocumentTitle(goal?.name ?? 'Sparmål');

  const afterChange = () => {
    setMovement(null);
    setEditing(false);
    state.reload();
    void refresh();
  };

  const toggleArchive = async () => {
    if (!goal) return;
    setBusy(true);
    try {
      if (goal.archived) {
        await api.unarchiveGoal(goal.id);
        push('Sparmålet är återaktiverat.');
      } else {
        await api.archiveGoal(goal.id);
        push('Sparmålet är arkiverat.');
      }
      setArchiving(false);
      afterChange();
    } catch (error) {
      push((error as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const removeGoal = async () => {
    if (!goal) return;
    setBusy(true);
    try {
      await api.deleteGoal(goal.id);
      forgetCelebrated(goal.id);
      push('Sparmålet är borttaget.');
      navigate('/mal', { replace: true });
    } catch (error) {
      push((error as Error).message, 'error');
      setDeleting(false);
    } finally {
      setBusy(false);
    }
  };

  if (state.loading) {
    return (
      <>
        <Skeleton hero lines={4} />
        <Skeleton lines={5} />
      </>
    );
  }

  if (state.error) {
    if (state.error.status === 404) {
      return (
        <div className="card">
          <EmptyState
            title="Sparmålet hittades inte"
            description="Det kan ha tagits bort, eller så tillhör det ett annat konto."
            action={<Button onClick={() => navigate('/mal')}>Till mina sparmål</Button>}
          />
        </div>
      );
    }
    return <ErrorState message={state.error.message} onRetry={state.reload} />;
  }

  if (!state.data || !goal) return null;

  const nextMilestone = goal.milestones.find((item) => !item.reached);

  return (
    <>
      <div className="row" style={{ gap: 8 }}>
        <Link to="/mal" className="btn btn--ghost btn--sm">
          <Icon name="chevronLeft" size={16} /> Alla sparmål
        </Link>
      </div>

      <GoalHero goal={goal} timezone={user?.profile.timezone ?? 'Europe/Stockholm'} />

      {goal.archived ? (
        <Banner tone="info" title="Arkiverat mål" icon="info">
          Arkiverade mål är skrivskyddade. Avarkivera för att sätta in eller ta ut pengar.
        </Banner>
      ) : null}

      {goal.lockedTarget ? (
        <Banner tone="warning" title="Målbeloppet är låst" icon="lock">
          Målet deltar i {goal.activeCompetitionCount} aktiv eller kommande tävling. Målbeloppet kan inte ändras förrän
          tävlingen är avslutad, så att alla tävlar på samma villkor.
        </Banner>
      ) : null}

      {!goal.archived ? (
        <div className="goal-actions goal-actions--three">
          <button type="button" className="action-card" onClick={() => setMovement('deposit')}>
            <span className="action-card__icon">
              <Icon name="arrowDownLeft" size={17} />
            </span>
            Sätt in
          </button>
          <button type="button" className="action-card action-card--out" onClick={() => setMovement('withdrawal')}>
            <span className="action-card__icon">
              <Icon name="arrowUpRight" size={17} />
            </span>
            Ta ut
          </button>
          <button type="button" className="action-card" onClick={() => setEditing(true)}>
            <span className="action-card__icon">
              <Icon name="edit" size={17} />
            </span>
            Redigera
          </button>
        </div>
      ) : null}

      <div className="detail-grid">
        <div className="stack">
          <section className="card card--pad section" aria-labelledby="movements-title">
            <SectionHeader id="movements-title" title="Sparhistorik" subtitle="Insättningar och uttag för det här målet." />
            {state.data.movements.length === 0 ? (
              <EmptyState
                variant="receipt"
                title="Ingen historik än"
                description="Sätt in din första slant – även små belopp räknas mot målet."
                action={
                  !goal.archived ? (
                    <Button variant="secondary" icon="arrowDownLeft" onClick={() => setMovement('deposit')}>
                      Sätt in pengar
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="movement-list">
                {state.data.movements.map((item) => (
                  <div key={item.id} className="movement">
                    <span className={`transaction-icon ${item.type === 'deposit' ? 'transaction-icon--income' : 'transaction-icon--expense'}`} aria-hidden="true">
                      {item.type === 'deposit' ? '↓' : '↑'}
                    </span>
                    <span className="movement__body">
                      <span className="movement__title">{item.type === 'deposit' ? 'Insättning' : 'Uttag'}</span>
                      <span className="movement__note">
                        {item.note ? `${item.note} · ` : ''}
                        {formatDateTime(item.occurredAt, user?.profile.timezone)} · saldo {formatSek(item.balanceAfterOre)}
                      </span>
                    </span>
                    <span className={`movement__amount movement__amount--${item.type === 'deposit' ? 'in' : 'out'}`}>
                      {item.type === 'deposit' ? '+' : '−'}
                      {formatSek(item.amountOre)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card card--pad section" aria-labelledby="goal-achievements">
            <SectionHeader id="goal-achievements" title="Bedrifter för målet" />
            {state.data.achievements.length === 0 ? (
              <p className="small muted">Inga bedrifter än. De låses upp vid 10, 25, 50, 75 och 100 %.</p>
            ) : (
              <div className="row wrap" style={{ gap: 8 }}>
                {state.data.achievements.map((achievement) => (
                  <Pill key={achievement.code} tone="gold">
                    {achievement.badge} {achievement.name}
                  </Pill>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="stack">
          <section className="card card--pad section" aria-labelledby="milestones-title">
            <SectionHeader id="milestones-title" title="Milstolpar" />
            <MilestoneList milestones={goal.milestones} />
          </section>

          {nextMilestone ? (
            <section className="milestone-spotlight">
              <span className="milestone-spotlight__badge" aria-hidden="true">
                {nextMilestone.badge}
              </span>
              <div className="grow">
                <p className="milestone-spotlight__title">Nästa: {nextMilestone.name}</p>
                <p className="milestone-spotlight__text">
                  {formatSek(
                    Math.ceil(((nextMilestone.thresholdBps - goal.progressBps) / 10000) * goal.targetAmountOre),
                  )}{' '}
                  kvar till {Math.round(nextMilestone.thresholdBps / 100)} %.
                </p>
                <ProgressBar
                  tone="gold"
                  valueBps={Math.round((goal.progressBps / nextMilestone.thresholdBps) * 10000)}
                />
              </div>
            </section>
          ) : (
            <Banner tone="success" title="Målet är uppnått 🏆" icon="check">
              Fantastiskt jobbat! Du kan sätta ett nytt mål eller låta pengarna stanna kvar.
            </Banner>
          )}

          <section className="card card--pad stack" aria-labelledby="goal-settings">
            <SectionHeader id="goal-settings" title="Inställningar" />
            <div className="row row--between small">
              <span className="muted">Integritet</span>
              <span>{goal.privacy === 'private' ? 'Privat' : 'Alias-synligt'}</span>
            </div>
            <div className="row row--between small">
              <span className="muted">Skapat</span>
              <span>{formatDateTime(goal.createdAt, user?.profile.timezone)}</span>
            </div>
            <div className="row row--between small">
              <span className="muted">Tävlingar</span>
              <span>{goal.activeCompetitionCount === 0 ? 'Inga aktiva' : `${goal.activeCompetitionCount} aktiva`}</span>
            </div>
            <hr className="divider" />
            <div className="row wrap" style={{ gap: 8 }}>
              <Button variant="secondary" size="sm" onClick={() => setArchiving(true)}>
                {goal.archived ? 'Avarkivera' : 'Arkivera'}
              </Button>
              <Button variant="ghost" onClick={() => setDeleting(true)}>
                Ta bort mål
              </Button>
            </div>
          </section>
        </div>
      </div>

      {goal && isGoalComplete(goal) && !hasCelebrated(goal.id) && !celebrating ? (
        <section className="celebrate-prompt" aria-label="Målet är fullsparat">
          <div className="celebrate-prompt__text">
            <strong>Målet är fullsparat – det väntar en present.</strong>
            <span>Sparly-hunden har något till dig.</span>
          </div>
          <Button icon="gift" onClick={() => setCelebrating(true)}>
            Öppna presenten
          </Button>
        </section>
      ) : null}

      <GoalCelebration goal={goal ?? null} open={celebrating} onClose={() => setCelebrating(false)} onCelebrated={() => state.reload()} />

      <Modal open={movement !== null} onClose={() => setMovement(null)} title={movement === 'deposit' ? 'Sätt in pengar' : 'Ta ut pengar'}>
        {movement ? (
          <MovementForm
            goal={goal}
            initialType={movement}
            onCancel={() => setMovement(null)}
            onDone={(updated) => {
              const justCompleted = goal ? !isGoalComplete(goal) && isGoalComplete(updated) : false;
              afterChange();
              if (justCompleted) setCelebrating(true);
            }}
          />
        ) : null}
      </Modal>

      <Modal open={editing} onClose={() => setEditing(false)} title="Redigera sparmål">
        <GoalForm
          goal={goal}
          onCancel={() => setEditing(false)}
          onDone={(updated: Goal) => {
            void updated;
            afterChange();
          }}
        />
      </Modal>

      <ConfirmDialog
        open={archiving}
        title={goal.archived ? 'Avarkivera sparmålet?' : 'Arkivera sparmålet?'}
        message={
          goal.archived
            ? 'Målet blir aktivt igen och kan ta emot insättningar.'
            : 'Målet blir skrivskyddat men historiken finns kvar. Du kan avarkivera när som helst.'
        }
        confirmLabel={goal.archived ? 'Avarkivera' : 'Arkivera'}
        loading={busy}
        onConfirm={toggleArchive}
        onCancel={() => setArchiving(false)}
      />

      <ConfirmDialog
        open={deleting}
        title="Ta bort sparmålet?"
        message="All sparhistorik för målet raderas permanent. Transaktioner som är kopplade till målet finns kvar men utan koppling."
        confirmLabel="Ta bort permanent"
        danger
        loading={busy}
        onConfirm={removeGoal}
        onCancel={() => setDeleting(false)}
      />
    </>
  );
}
