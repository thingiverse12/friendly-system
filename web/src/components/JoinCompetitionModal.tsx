import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useToast } from '../toast';
import { formatSek } from '../format';
import type { Goal } from '../types';
import { Banner, Button, EmptyState, Modal, ProgressBar } from './UI';

export function JoinCompetitionModal({
  open,
  competitionId,
  competitionName,
  goals,
  onClose,
  onJoined,
}: {
  open: boolean;
  competitionId: string;
  competitionName: string;
  goals: Goal[];
  onClose: () => void;
  onJoined: () => void;
}) {
  const [goalId, setGoalId] = useState(goals[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { push } = useToast();

  const join = async () => {
    if (!goalId) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.joinCompetition(competitionId, goalId);
      push(
        result.joinedActive
          ? 'Du är med! Ditt startsaldo är låst och jakten har börjat.'
          : 'Du är anmäld. Startsaldot låses när tävlingen startar.',
      );
      onJoined();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const activeGoals = goals.filter((goal) => !goal.archived);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Gå med i ${competitionName}`}
      description="Välj vilket sparmål du tävlar med. Målbeloppet låses när tävlingen startar."
      footer={
        activeGoals.length > 0 ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Avbryt
            </Button>
            <Button onClick={join} loading={busy} disabled={!goalId}>
              Gå med
            </Button>
          </>
        ) : undefined
      }
    >
      {error ? (
        <Banner tone="error" title="Kunde inte gå med" icon="info">
          {error}
        </Banner>
      ) : null}

      {activeGoals.length === 0 ? (
        <EmptyState
          title="Du behöver ett sparmål"
          description="Skapa ett sparmål först – sedan kan du tävla med det."
          action={
            <Link to="/mal" className="btn btn--primary">
              Skapa sparmål
            </Link>
          }
        />
      ) : (
        <>
          <div className="mini-goal-list" role="radiogroup" aria-label="Välj sparmål">
            {activeGoals.map((goal) => (
              <button
                key={goal.id}
                type="button"
                role="radio"
                aria-checked={goalId === goal.id}
                className="mini-goal"
                style={goalId === goal.id ? { borderColor: 'var(--emerald)', background: 'var(--emerald-tint)' } : undefined}
                onClick={() => setGoalId(goal.id)}
              >
                <span className="mini-goal__art" aria-hidden="true">
                  {goalId === goal.id ? '✓' : '🌱'}
                </span>
                <span className="mini-goal__body">
                  <span className="mini-goal__name">
                    {goal.name}
                    <span>{formatSek(goal.balanceOre)}</span>
                  </span>
                  <ProgressBar valueBps={goal.progressBps} />
                </span>
              </button>
            ))}
          </div>
          <Banner tone="info" title="Så räknas poängen" icon="info">
            Poäng = 100 × (aktuellt saldo − startsaldo) / låst målbelopp. Endast förändringar efter starten räknas, och uttag
            sänker poängen.
          </Banner>
        </>
      )}
    </Modal>
  );
}
