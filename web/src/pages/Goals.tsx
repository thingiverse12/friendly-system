import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { useAsync, useDocumentTitle } from '../hooks';
import { formatSek } from '../format';
import { GoalCard } from '../components/Cards';
import { GoalForm } from '../components/Forms';
import { Button, EmptyState, ErrorState, Modal, Segmented, Skeleton } from '../components/UI';
import type { Goal } from '../types';

export function Goals() {
  useDocumentTitle('Sparmål');
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'active' | 'archived'>('active');
  const [creating, setCreating] = useState(false);
  const state = useAsync<{ goals: Goal[]; totals: { savedOre: number; targetOre: number } }>(
    async (signal) => api.goals(true),
    [],
  );

  const goals = state.data?.goals ?? [];
  const active = goals.filter((goal) => !goal.archived);
  const archived = goals.filter((goal) => goal.archived);
  const visible = tab === 'active' ? active : archived;
  const saved = active.reduce((sum, goal) => sum + goal.balanceOre, 0);
  const target = active.reduce((sum, goal) => sum + goal.targetAmountOre, 0);

  const afterCreate = (goal: Goal) => {
    setCreating(false);
    state.reload();
    void refresh();
    navigate(`/mal/${goal.id}`);
  };

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1 className="page-head__title">Sparmål</h1>
          <p className="page-head__subtitle">
            {active.length} aktiva mål · {formatSek(saved)} sparat av {formatSek(target)}
          </p>
        </div>
        <div className="page-head__actions">
          <Button icon="plus" onClick={() => setCreating(true)}>
            Nytt sparmål
          </Button>
        </div>
      </header>

      <Segmented
        label="Visa sparmål"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'active', label: 'Aktiva', count: active.length },
          { value: 'archived', label: 'Arkiverade', count: archived.length },
        ]}
      />

      {state.loading ? <Skeleton hero lines={3} /> : null}
      {state.error ? <ErrorState message={state.error.message} onRetry={state.reload} /> : null}

      {state.data ? (
        visible.length === 0 ? (
          <div className="card">
            <EmptyState
              mascot
              title={tab === 'active' ? 'Inga aktiva sparmål' : 'Inga arkiverade sparmål'}
              description={
                tab === 'active'
                  ? 'Sätt ett mål – en resa, en buffert eller något du drömt om länge. Små steg räknas.'
                  : 'När du är klar med ett mål kan du arkivera det. Historiken finns kvar.'
              }
              action={
                tab === 'active' ? (
                  <Button icon="plus" onClick={() => setCreating(true)}>
                    Skapa ditt första mål
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="goal-grid">
            {visible.map((goal) => (
              <GoalCard key={goal.id} goal={goal} />
            ))}
          </div>
        )
      ) : null}

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Nytt sparmål"
        description="Ett tydligt mål gör det lättare att hålla kursen."
      >
        <GoalForm onCancel={() => setCreating(false)} onDone={afterCreate} />
      </Modal>
    </>
  );
}
