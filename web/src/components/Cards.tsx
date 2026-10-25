import { Link } from 'react-router-dom';
import type { AchievementCatalogItem, CompetitionSummary, Goal, Milestone } from '../types';
import { daysLeft, formatScore, formatSek, timeLeft } from '../format';
import { Icon } from './Icon';
import { Pill, ProgressBar, ProgressRing } from './UI';

export function GoalCard({ goal, showLink = true }: { goal: Goal; showLink?: boolean }) {
  const content = (
    <>
      <div className="goal-card__head">
        <div>
          <p className="goal-card__name">{goal.name}</p>
          <p className="goal-card__amounts">
            <strong>{formatSek(goal.balanceOre)}</strong>
            <span> av {formatSek(goal.targetAmountOre)}</span>
          </p>
        </div>
        <div className="goal-card__percent">
          <span>{Math.round(goal.progressBps / 100)} %</span>
          {goal.lockedTarget ? (
            <span className="goal-card__lock" title="Målbeloppet är låst under tävling">
              <Icon name="lock" size={14} />
            </span>
          ) : null}
        </div>
      </div>
      <ProgressBar valueBps={goal.progressBps} />
      <div className="goal-card__foot">
        <span>{goal.archived ? 'Arkiverat' : `${formatSek(goal.remainingOre)} kvar`}</span>
        {goal.activeCompetitionCount > 0 ? <Pill tone="emerald">Tävlar</Pill> : null}
      </div>
    </>
  );

  if (!showLink) return <div className="goal-card">{content}</div>;
  return (
    <Link to={`/mal/${goal.id}`} className="goal-card goal-card--link" aria-label={`Öppna sparmålet ${goal.name}`}>
      {content}
      <span className="goal-card__chevron" aria-hidden="true">
        <Icon name="chevronRight" size={18} />
      </span>
    </Link>
  );
}

export function GoalHero({ goal, timezone }: { goal: Goal; timezone: string }) {
  void timezone;
  return (
    <section className="goal-hero" aria-labelledby="goal-hero-title">
      <div className="goal-hero__text">
        <p className="goal-hero__eyebrow">
          {goal.lockedTarget ? (
            <>
              <Icon name="lock" size={14} /> Målbeloppet är låst under tävlingen
            </>
          ) : (
            'Sparmål'
          )}
        </p>
        <h1 id="goal-hero-title" className="goal-hero__title">
          {goal.name}
        </h1>
        <p className="goal-hero__amount">
          {formatSek(goal.balanceOre)} <span>av {formatSek(goal.targetAmountOre)}</span>
        </p>
        <dl className="goal-hero__stats">
          <div>
            <dt>Kvar</dt>
            <dd>{formatSek(goal.remainingOre)}</dd>
          </div>
          <div>
            <dt>Framsteg</dt>
            <dd>{Math.round(goal.progressBps / 100)} %</dd>
          </div>
          <div>
            <dt>Skapat</dt>
            <dd>{new Date(goal.createdAt).toLocaleDateString('sv-SE')}</dd>
          </div>
        </dl>
      </div>
      <ProgressRing valueBps={goal.progressBps} size={132} stroke={11} label={`${goal.name}, ${Math.round(goal.progressBps / 100)} procent sparat`}>
        <span className="ring__percent">{Math.round(goal.progressBps / 100)}%</span>
        <span className="ring__caption">av målet</span>
      </ProgressRing>
    </section>
  );
}

export function MilestoneList({ milestones, compact = false }: { milestones: Milestone[]; compact?: boolean }) {
  return (
    <ol className={`milestones ${compact ? 'milestones--compact' : ''}`} aria-label="Milstolpar">
      {milestones.map((milestone) => (
        <li key={milestone.code} className={`milestone ${milestone.reached ? 'is-reached' : ''}`}>
          <span className="milestone__dot" aria-hidden="true">
            {milestone.reached ? '✓' : ''}
          </span>
          <span className="milestone__badge" aria-hidden="true">
            {milestone.badge}
          </span>
          <span className="milestone__name">{milestone.name}</span>
          <span className="milestone__threshold">{Math.round(milestone.thresholdBps / 100)} %</span>
          {milestone.reached ? <span className="visually-hidden">Uppnådd</span> : null}
        </li>
      ))}
    </ol>
  );
}

export function CompetitionCard({
  competition,
  onJoin,
  joining,
  joinDisabledReason,
}: {
  competition: CompetitionSummary;
  onJoin?: () => void;
  joining?: boolean;
  joinDisabledReason?: string | null;
}) {
  const statusLabel =
    competition.status === 'active'
      ? timeLeft(competition.endsAt)
      : competition.status === 'upcoming'
        ? `Startar ${new Date(competition.startsAt).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}`
        : 'Avslutad';
  const isCompleted = competition.status === 'completed' || competition.status === 'cancelled';
  return (
    <article className={`competition-card ${isCompleted ? 'competition-card--done' : ''}`}>
      <div className="competition-card__art" aria-hidden="true">
        <div className="competition-card__sun" />
        <div className="competition-card__ridge competition-card__ridge--far" />
        <div className="competition-card__ridge competition-card__ridge--near" />
      </div>
      <div className="competition-card__body">
        <div className="competition-card__top">
          <Pill tone={competition.durationDays === 7 ? 'emerald' : 'navy'}>{competition.durationDays} dagar</Pill>
          <span className="competition-card__status">
            <Icon name="clock" size={14} />
            {statusLabel}
          </span>
        </div>
        <h3 className="competition-card__title">{competition.name}</h3>
        <p className="competition-card__meta">
          {competition.visibility === 'public' ? 'Offentlig' : 'Privat grupp'} ·{' '}
          {competition.participantCount} deltagare
          {competition.durationDays ? ` · ${daysLeft(competition.endsAt) === 0 && competition.status === 'active' ? 'sista dagen' : ''}` : ''}
        </p>
        {competition.joined ? (
          <div className="competition-card__score">
            <div>
              <span className="competition-card__score-label">Din poäng</span>
              <strong>{competition.myScore !== null ? formatScore(competition.myScore * 100) : '—'}</strong>
            </div>
            <div>
              <span className="competition-card__score-label">Placering</span>
              <strong>#{competition.myRank ?? '—'}</strong>
            </div>
          </div>
        ) : null}
        <div className="competition-card__actions">
          <Link className="btn btn--secondary btn--sm" to={`/tavlingar/${competition.id}`}>
            Se topplista
          </Link>
          {!competition.joined && !isCompleted && onJoin ? (
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={onJoin}
              disabled={joining || Boolean(joinDisabledReason)}
              title={joinDisabledReason ?? undefined}
            >
              {joining ? <span className="spinner" aria-hidden="true" /> : null}
              Gå med
            </button>
          ) : null}
        </div>
        {!competition.joined && joinDisabledReason ? (
          <p className="competition-card__hint">{joinDisabledReason}</p>
        ) : null}
      </div>
    </article>
  );
}

export function AchievementTile({
  achievement,
  earned,
}: {
  achievement: AchievementCatalogItem;
  earned: boolean;
}) {
  return (
    <article className={`achievement ${earned ? 'is-earned' : ''}`}>
      <div className="achievement__badge" aria-hidden="true">
        {achievement.badge}
      </div>
      <div className="achievement__text">
        <h3>{achievement.name}</h3>
        <p>{achievement.description}</p>
        <p className="achievement__meta">
          {earned
            ? `Uppnådd${achievement.earnedAt ? ` ${new Date(achievement.earnedAt).toLocaleDateString('sv-SE')}` : ''}${achievement.earnedCount > 1 ? ` · ${achievement.earnedCount} mål` : ''}`
            : `${Math.round(achievement.thresholdBps / 100)} % av målet`}
        </p>
      </div>
      <span className={`achievement__check ${earned ? 'is-on' : ''}`} aria-hidden="true">
        {earned ? <Icon name="check" size={16} /> : null}
      </span>
    </article>
  );
}
