import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { useAsync, useDocumentTitle } from '../hooks';
import { formatDate } from '../format';
import { AchievementTile } from '../components/Cards';
import { Button, EmptyState, ErrorState, ProgressBar, SectionHeader, Skeleton } from '../components/UI';
import type { AchievementsResponse } from '../types';

const LEVEL_NAMES = ['Nybörjare', 'Sparare', 'Målmedveten', 'Sparproffs', 'Sparmästare'];
const LEVEL_REQUIREMENTS = [0, 2, 3, 4, 5];

export function Achievements() {
  useDocumentTitle('Bedrifter');
  const { user } = useAuth();
  const navigate = useNavigate();
  const state = useAsync<AchievementsResponse>(async () => api.achievements(), []);

  const data = state.data;
  const earnedAwards =
    data?.catalog
      .flatMap((item) =>
        item.goals.map((award) => ({
          ...award,
          name: item.name,
          badge: item.badge,
          description: item.description,
        })),
      )
      .sort((a, b) => Date.parse(b.earnedAt) - Date.parse(a.earnedAt)) ?? [];

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1 className="page-head__title">Bedrifter</h1>
          <p className="page-head__subtitle">Varje milstolpe räknas. Lås upp nivåer genom att nå dina delmål.</p>
        </div>
      </header>

      {state.loading ? <Skeleton hero lines={5} /> : null}
      {state.error ? <ErrorState message={state.error.message} onRetry={state.reload} /> : null}

      {data ? (
        <>
          <section className="level-card" aria-labelledby="level-title">
            <div className="level-card__medal" aria-hidden="true">
              🏅
            </div>
            <div className="level-card__body">
              <p className="level-card__eyebrow">Din nivå</p>
              <h2 className="level-card__title" id="level-title">
                Nivå {data.level.level} · {data.level.name}
              </h2>
              <p className="level-card__meta">
                {data.totalEarned} av {data.catalog.length} bedrifter upplåsta
                {data.totalAwards > data.totalEarned ? ` · ${data.totalAwards} upplåsningar totalt` : ''}
                {data.level.nextLevelAt ? ` · ${data.level.nextLevelAt - data.totalEarned} kvar till nästa nivå` : ' · högsta nivån'}
              </p>
              <ProgressBar tone="gold" valueBps={data.level.progressToNextBps} />
            </div>
          </section>

          <section className="section" aria-labelledby="catalog-title">
            <SectionHeader
              id="catalog-title"
              title="Alla bedrifter"
              subtitle="Bedrifter verifieras av servern när ditt sparande når milstolpen. De kan aldrig delas ut två gånger."
            />
            <div className="achievement-grid">
              {data.catalog.map((achievement) => (
                <AchievementTile
                  key={achievement.code}
                  achievement={achievement}
                  earned={achievement.earnedCount > 0}
                />
              ))}
            </div>
          </section>

          <div className="detail-grid">
            <section className="card card--pad section" aria-labelledby="award-history">
              <SectionHeader id="award-history" title="Senaste upplåsningar" />
              {earnedAwards.length === 0 ? (
                <EmptyState
                  title="Inga bedrifter än"
                  description="Sätt in pengar på ett sparmål. Redan vid 10 % låser du upp din första bedrift."
                  action={
                    <Link to="/mal" className="btn btn--primary">
                      Till mina sparmål
                    </Link>
                  }
                />
              ) : (
                <ol className="movement-list">
                  {earnedAwards.slice(0, 8).map((award) => (
                    <li key={`${award.goalId}-${award.name}-${award.earnedAt}`} className="movement">
                      <span className="achievement__badge" aria-hidden="true" style={{ width: 38, height: 38, fontSize: '1.05rem' }}>
                        {award.badge}
                      </span>
                      <span className="movement__body">
                        <span className="movement__title">{award.name}</span>
                        <span className="movement__note">
                          {award.goalName} · {formatDate(award.earnedAt, user?.profile.timezone)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section className="card card--pad section" aria-labelledby="level-ladder-title">
              <SectionHeader id="level-ladder-title" title="Nivåer" subtitle="Nivån styrs av hur många bedrifter du låst upp." />
              <ol className="level-ladder">
                {LEVEL_REQUIREMENTS.map((required, index) => {
                  const level = index + 1;
                  const reached = data.totalEarned >= required;
                  return (
                    <li key={level} className={`level-ladder__row ${data.level.level === level ? 'is-current' : ''}`}>
                      <span className="level-ladder__num">{level}</span>
                      <span className="grow">
                        <strong>{LEVEL_NAMES[index]}</strong>
                        <span className="muted small" style={{ display: 'block' }}>
                          {required === 0 ? 'Från start' : `${required} bedrifter`}
                        </span>
                      </span>
                      <span className={`pill ${reached ? 'pill--emerald' : ''}`}>{reached ? 'Uppnådd' : 'Låst'}</span>
                    </li>
                  );
                })}
              </ol>
              <Button variant="secondary" icon="target" onClick={() => navigate('/mal')}>
                Sätt ett nytt mål
              </Button>
            </section>
          </div>
        </>
      ) : null}
    </>
  );
}
