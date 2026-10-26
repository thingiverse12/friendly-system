import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { useAsync, useDocumentTitle } from '../hooks';
import { useToast } from '../toast';
import { formatSek, greeting, formatShortDate } from '../format';
import { FjordScene } from '../components/Illustrations';
import { Icon } from '../components/Icon';
import {
  Button,
  EmptyState,
  ErrorState,
  Modal,
  Pill,
  ProgressBar,
  ProgressRing,
  SectionHeader,
  Skeleton,
} from '../components/UI';
import { MovementForm, TransactionForm } from '../components/Forms';
import { GoalCelebration, isGoalComplete } from '../components/Celebration';
import { RecurringCard } from '../components/Recurring';
import type { DashboardData, Goal, RecurringResponse } from '../types';

export function Dashboard() {
  useDocumentTitle('Hem');
  const { user, refresh } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [transactionType, setTransactionType] = useState<'income' | 'expense' | null>(null);
  const [savingGoal, setSavingGoal] = useState<Goal | null>(null);
  const [celebrateGoal, setCelebrateGoal] = useState<Goal | null>(null);
  const [choosingGoal, setChoosingGoal] = useState(false);

  const state = useAsync<DashboardData>((signal) => api.dashboard(), []);
  const recurringState = useAsync<RecurringResponse>(async () => api.recurring(), []);
  const goalsState = useAsync<{ goals: Goal[]; totals: { savedOre: number; targetOre: number } }>(
    async () => api.goals(false),
    [],
  );

  const data = state.data;
  const goals = goalsState.data?.goals ?? [];

  const afterChange = () => {
    state.reload();
    goalsState.reload();
    void refresh();
  };

  const startSave = () => {
    if (goals.length === 0) {
      push('Skapa ett sparmål först, så kan du sätta in pengar.', 'info');
      navigate('/mal');
      return;
    }
    if (goals.length === 1) setSavingGoal(goals[0]!);
    else setChoosingGoal(true);
  };

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1 className="page-head__title">
            {greeting()}, {user?.profile.alias?.split(/[_\s]/)[0] ?? 'du'}! <span aria-hidden="true">🌿</span>
          </h1>
          <p className="page-head__subtitle">Här är din ekonomiska översikt.</p>
        </div>
        <div className="page-head__actions">
          <Button variant="secondary" icon="plus" onClick={() => setTransactionType('expense')}>
            Ny transaktion
          </Button>
        </div>
      </header>

      {state.loading ? <Skeleton hero lines={4} /> : null}
      {state.error ? <ErrorState message={state.error.message} onRetry={state.reload} /> : null}

      {data ? (
        <>
          <section className="dash-hero" aria-labelledby="dash-total">
            <FjordScene className="dash-hero__scene" variant="night" />
            <div className="dash-hero__content">
              <p className="dash-hero__eyebrow">
                <Icon name="wallet" size={14} /> Totalt sparat
              </p>
              <p className="dash-hero__amount" id="dash-total">
                {formatSek(data.totals.savedOre)}
              </p>
              <p className="dash-hero__label">
                av {formatSek(data.totals.targetOre)} i {data.totals.activeGoals}{' '}
                {data.totals.activeGoals === 1 ? 'aktivt mål' : 'aktiva mål'}
              </p>
              <div className="dash-hero__meta">
                <span>
                  <strong>{Math.round(data.month.incomeOre / 100).toLocaleString('sv-SE')} kr</strong> in denna månad
                </span>
                <span>
                  <strong>{Math.round(data.month.expenseOre / 100).toLocaleString('sv-SE')} kr</strong> ut denna månad
                </span>
              </div>
            </div>
            <div className="dash-hero__ring">
              <ProgressRing valueBps={data.totals.progressBps} size={118} stroke={10} tone="light" label={`${Math.round(data.totals.progressBps / 100)} procent av totala mål`}>
                <span className="ring__percent">{Math.round(data.totals.progressBps / 100)}%</span>
                <span className="ring__caption">av målen</span>
              </ProgressRing>
            </div>
          </section>

          <nav className="quick-actions" aria-label="Snabba åtgärder">
            <button type="button" className="quick-action" onClick={() => setTransactionType('income')}>
              <span className="quick-action__icon">
                <Icon name="arrowDownLeft" size={19} />
              </span>
              Ny inkomst
            </button>
            <button type="button" className="quick-action" onClick={() => setTransactionType('expense')}>
              <span className="quick-action__icon">
                <Icon name="arrowUpRight" size={19} />
              </span>
              Ny utgift
            </button>
            <button type="button" className="quick-action quick-action--dark" onClick={startSave}>
              <span className="quick-action__icon">
                <Icon name="wallet" size={19} />
              </span>
              Spara
            </button>
            <Link to="/mal" className="quick-action quick-action--gold">
              <span className="quick-action__icon">
                <Icon name="target" size={19} />
              </span>
              Mål
            </Link>
          </nav>

          <div className="stat-grid">
            <div className="stat-tile">
              <span className="stat-tile__label">
                <Icon name="arrowDownLeft" size={13} /> Inkomster
              </span>
              <span className="stat-tile__value stat-tile__value--income">{formatSek(data.month.incomeOre)}</span>
              <span className="stat-tile__meta">denna månad</span>
            </div>
            <div className="stat-tile">
              <span className="stat-tile__label">
                <Icon name="arrowUpRight" size={13} /> Utgifter
              </span>
              <span className="stat-tile__value stat-tile__value--expense">{formatSek(data.month.expenseOre)}</span>
              <span className="stat-tile__meta">{data.totals.transactionsThisMonth} transaktioner</span>
            </div>
            <div className="stat-tile">
              <span className="stat-tile__label">
                <Icon name="wallet" size={13} /> Netto
              </span>
              <span className={`stat-tile__value ${data.month.netOre >= 0 ? 'stat-tile__value--income' : 'stat-tile__value--expense'}`}>
                {formatSek(data.month.netOre, { signed: true })}
              </span>
              <span className="stat-tile__meta">inkomst minus utgift</span>
            </div>
            <div className="stat-tile">
              <span className="stat-tile__label">
                <Icon name="medal" size={13} /> Bedrifter
              </span>
              <span className="stat-tile__value">
                {data.achievements.earned} <span className="muted" style={{ fontSize: '0.8rem' }}>/ {data.achievements.total}</span>
              </span>
              <span className="stat-tile__meta">nivå {data.level.level} · {data.level.name}</span>
            </div>
          </div>

          <div className="dash-split">
            <div className="stack" style={{ gap: 24 }}>
              <section className="section" aria-labelledby="my-goals">
                <SectionHeader
                  id="my-goals"
                  title="Mina sparmål"
                  action={<Link to="/mal">Se alla</Link>}
                />
                {data.goals.length === 0 ? (
                  <div className="card">
                    <EmptyState
                      mascot
                      title="Inga sparmål än"
                      description="Skapa ditt första mål och börja bygga din buffert, en liten summa i taget."
                      action={
                        <Button icon="plus" onClick={() => navigate('/mal')}>
                          Skapa sparmål
                        </Button>
                      }
                    />
                  </div>
                ) : (
                  <div className="mini-goal-list">
                    {data.goals.map((goal) => (
                      <Link key={goal.id} to={`/mal/${goal.id}`} className="mini-goal">
                        <span className="mini-goal__art" aria-hidden="true">
                          {goal.progressBps >= 10000 ? '🏆' : goal.progressBps >= 5000 ? '⛰️' : '🌱'}
                        </span>
                        <span className="mini-goal__body">
                          <span className="mini-goal__name">
                            {goal.name}
                            <span>
                              {formatSek(goal.balanceOre)} / {formatSek(goal.targetAmountOre)}
                            </span>
                          </span>
                          <ProgressBar valueBps={goal.progressBps} />
                          <span className="mini-goal__meta">
                            <span>{Math.round(goal.progressBps / 100)} %</span>
                            <span>{formatSek(goal.remainingOre)} kvar</span>
                          </span>
                        </span>
                        <Icon name="chevronRight" size={17} />
                      </Link>
                    ))}
                  </div>
                )}
              </section>

              <section className="section" aria-labelledby="recent">
                <SectionHeader id="recent" title="Senaste transaktioner" action={<Link to="/transaktioner">Visa alla</Link>} />
                <div className="card card--pad">
                  {data.recentTransactions.length === 0 ? (
                    <EmptyState
                      variant="receipt"
                      title="Inga transaktioner än"
                      description="Logga din första inkomst eller utgift för att få en tydlig översikt."
                      action={
                        <Button variant="secondary" icon="plus" onClick={() => setTransactionType('expense')}>
                          Lägg till transaktion
                        </Button>
                      }
                    />
                  ) : (
                    <div className="recent-list">
                      {data.recentTransactions.map((transaction) => (
                        <div key={transaction.id} className="recent-row">
                          <span className={`transaction-icon transaction-icon--${transaction.type}`} aria-hidden="true">
                            {transaction.type === 'income' ? '↓' : '↑'}
                          </span>
                          <span className="recent-row__body">
                            <span className="recent-row__title">{transaction.category}</span>
                            <span className="recent-row__meta">
                              {formatShortDate(transaction.occurredAt, user?.profile.timezone)}
                              {transaction.goalName ? ` · ${transaction.goalName}` : ''}
                            </span>
                          </span>
                          <span className={`recent-row__amount recent-row__amount--${transaction.type}`}>
                            {transaction.type === 'income' ? '+' : '−'}
                            {formatSek(transaction.amountOre)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>

            <div className="stack" style={{ gap: 16 }}>
              {data.nextMilestone ? (
                <section className="milestone-spotlight" aria-labelledby="next-milestone">
                  <span className="milestone-spotlight__badge" aria-hidden="true">
                    {data.nextMilestone.badge}
                  </span>
                  <div className="grow">
                    <p className="milestone-spotlight__title" id="next-milestone">
                      Nästa milstolpe: {data.nextMilestone.name}
                    </p>
                    <p className="milestone-spotlight__text">
                      {Math.round(data.nextMilestone.currentBps / 100)} % klart i {data.nextMilestone.goalName}.{' '}
                      {formatSek(data.nextMilestone.remainingOre)} kvar till{' '}
                      {Math.round(data.nextMilestone.thresholdBps / 100)} %.
                    </p>
                    <ProgressBar
                      tone="gold"
                      valueBps={Math.round((data.nextMilestone.currentBps / data.nextMilestone.thresholdBps) * 10000)}
                    />
                  </div>
                </section>
              ) : null}

              <section className="level-strip" aria-labelledby="level-strip-title">
                <span className="level-strip__medal" aria-hidden="true">
                  🏅
                </span>
                <div className="level-strip__body">
                  <p className="level-strip__title" id="level-strip-title">
                    Nivå {data.level.level} · {data.level.name}
                  </p>
                  <p className="level-strip__meta">
                    {data.level.nextLevelAt
                      ? `${data.achievements.earned} av ${data.level.nextLevelAt} bedrifter till nästa nivå`
                      : 'Du har nått högsta nivån'}
                  </p>
                  <ProgressBar tone="gold" valueBps={data.level.progressToNextBps} />
                </div>
                <Link to="/bedrifter" className="icon-button" aria-label="Visa bedrifter">
                  <Icon name="chevronRight" size={18} />
                </Link>
              </section>

              <Link to="/transaktioner" className="card-link">
                <RecurringCard
                  activeCount={recurringState.data?.summary.activeCount ?? 0}
                  monthlyExpenseOre={recurringState.data?.summary.monthlyExpenseOre ?? 0}
                  monthlyIncomeOre={recurringState.data?.summary.monthlyIncomeOre ?? 0}
                  nextDate={
                    recurringState.data?.rules.find((rule) => rule.active && rule.nextOccurrence)?.nextOccurrence ?? null
                  }
                />
              </Link>

              <section className="card card--pad stack" aria-labelledby="compete-title">
                <SectionHeader id="compete-title" title="Spartävlingar" />
                <p className="small muted" style={{ marginTop: -8 }}>
                  {data.competitions.active} aktiva tävlingar just nu. Du deltar i {data.competitions.joined}.
                </p>
                <div className="row wrap" style={{ gap: 8 }}>
                  <Pill tone="emerald">7 dagar</Pill>
                  <Pill tone="navy">30 dagar</Pill>
                  <Pill tone="gold">Vänskapsgrupper</Pill>
                </div>
                <Button variant="secondary" icon="trophy" onClick={() => navigate('/tavlingar')}>
                  Utforska tävlingar
                </Button>
              </section>
            </div>
          </div>
        </>
      ) : null}

      <Modal
        open={transactionType !== null}
        onClose={() => setTransactionType(null)}
        title={transactionType === 'income' ? 'Ny inkomst' : 'Ny utgift'}
        description="Inkomster och utgifter påverkar inte ditt sparande förrän du flyttar dem till ett mål."
      >
        <TransactionForm
          goals={goals}
          defaultType={transactionType ?? 'expense'}
          onCancel={() => setTransactionType(null)}
          onDone={() => {
            setTransactionType(null);
            afterChange();
          }}
        />
      </Modal>

      <Modal
        open={choosingGoal}
        onClose={() => setChoosingGoal(false)}
        title="Välj sparmål"
        description="Vilket mål vill du sätta in pengar i?"
      >
        <div className="mini-goal-list">
          {goals.map((goal) => (
            <button
              key={goal.id}
              type="button"
              className="mini-goal"
              onClick={() => {
                setChoosingGoal(false);
                setSavingGoal(goal);
              }}
            >
              <span className="mini-goal__art" aria-hidden="true">
                🌱
              </span>
              <span className="mini-goal__body">
                <span className="mini-goal__name">
                  {goal.name}
                  <span>{formatSek(goal.balanceOre)}</span>
                </span>
                <ProgressBar valueBps={goal.progressBps} />
              </span>
              <Icon name="chevronRight" size={17} />
            </button>
          ))}
        </div>
      </Modal>

      <Modal
        open={savingGoal !== null}
        onClose={() => setSavingGoal(null)}
        title={savingGoal ? `Spara till ${savingGoal.name}` : 'Spara'}
        description="Insättningar och uttag bokförs i sparmålets egen historik."
      >
        {savingGoal ? (
          <MovementForm
            goal={savingGoal}
            onCancel={() => setSavingGoal(null)}
            onDone={(updated) => {
              const justCompleted = savingGoal ? !isGoalComplete(savingGoal) && isGoalComplete(updated) : false;
              setSavingGoal(null);
              afterChange();
              if (justCompleted) setCelebrateGoal(updated);
            }}
          />
        ) : null}
      </Modal>

      <GoalCelebration goal={celebrateGoal} open={celebrateGoal !== null} onClose={() => setCelebrateGoal(null)} />
    </>
  );
}

