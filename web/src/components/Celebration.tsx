import { useEffect, useMemo, useRef, useState } from 'react';
import { formatSek } from '../format';
import type { Goal } from '../types';
import { Mascot } from './Mascot';
import { Button } from './UI';

/**
 * Firandet när ett sparmål är fullsparat.
 *
 * Steg 1: hunden kommer med en present – "Öppna presenten".
 * Steg 2: presenten öppnas, konfetti faller och hunden har partyhatt.
 *
 * Firandet är en ren UI-effekt. Det bokför ingenting och är aldrig en källa till sanning om saldot –
 * det enda som sparas i webbläsaren är en flagga för att veta vilka mål som redan firats.
 */

const CELEBRATED_KEY = 'sparly:celebrated-goals';

function readCelebrated(): string[] {
  try {
    const raw = window.localStorage.getItem(CELEBRATED_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function writeCelebrated(ids: string[]): void {
  try {
    window.localStorage.setItem(CELEBRATED_KEY, JSON.stringify([...new Set(ids)].slice(-100)));
  } catch {
    /* private mode / quota – the celebration is cosmetic, so failing silently is fine. */
  }
}

export function hasCelebrated(goalId: string): boolean {
  return readCelebrated().includes(goalId);
}

export function markCelebrated(goalId: string): void {
  writeCelebrated([...readCelebrated().filter((id) => id !== goalId), goalId]);
}

export function forgetCelebrated(goalId: string): void {
  writeCelebrated(readCelebrated().filter((id) => id !== goalId));
}

export function isGoalComplete(goal: Pick<Goal, 'balanceOre' | 'targetAmountOre'>): boolean {
  return goal.targetAmountOre > 0 && goal.balanceOre >= goal.targetAmountOre;
}

/** Deterministic pseudo-random so the confetti looks scattered but renders the same each time. */
function seeded(index: number, salt: number): number {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

const CONFETTI_COLORS = ['#0f6b52', '#b8902f', '#7fd3b4', '#e9d8a6', '#0b2a24', '#cfe6da'];

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 64 }, (_, index) => ({
        left: seeded(index, 1) * 100,
        delay: seeded(index, 2) * 0.9,
        duration: 2.4 + seeded(index, 3) * 2.2,
        drift: (seeded(index, 4) - 0.5) * 160,
        rotate: seeded(index, 5) * 360,
        size: 6 + Math.round(seeded(index, 6) * 7),
        color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
        round: seeded(index, 7) > 0.6,
      })),
    [],
  );

  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((piece, index) => (
        <span
          key={index}
          className={`confetti__piece ${piece.round ? 'confetti__piece--round' : ''}`}
          style={{
            left: `${piece.left}%`,
            width: piece.size,
            height: piece.round ? piece.size : piece.size * 0.45,
            background: piece.color,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
            ['--drift' as string]: `${piece.drift}px`,
            ['--spin' as string]: `${piece.rotate}deg`,
          }}
        />
      ))}
    </div>
  );
}

export function GoalCelebration({
  goal,
  open,
  onClose,
  onCelebrated,
}: {
  goal: Goal | null;
  open: boolean;
  onClose: () => void;
  onCelebrated?: (goalId: string) => void;
}) {
  const [step, setStep] = useState<'gift' | 'party'>('gift');
  const [hasParty, setHasParty] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setStep('gift');
      setHasParty(false);
    }
  }, [open, goal?.id]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.querySelector<HTMLElement>('button')?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const items = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((item) => item.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step]);

  const close = () => {
    if (goal) {
      markCelebrated(goal.id);
      onCelebrated?.(goal.id);
    }
    onClose();
  };

  if (!open || !goal) return null;

  const openPresent = () => {
    setStep('party');
    setHasParty(true);
  };

  return (
    <div className="celebrate" role="dialog" aria-modal="true" aria-labelledby="celebrate-title" ref={dialogRef}>
      {hasParty ? <Confetti /> : null}
      <div className={`celebrate__card celebrate__card--${step}`}>
        <div className="celebrate__art">
          <Mascot
            size={260}
            pose={step === 'party' ? 'party' : 'gift'}
            className={step === 'party' ? 'celebrate__dog celebrate__dog--party' : 'celebrate__dog'}
            decorative={false}
            title={step === 'party' ? 'Sparly-hunden firar med partyhatt' : 'Sparly-hunden kommer med en present'}
          />
        </div>

        {step === 'gift' ? (
          <>
            <p className="celebrate__eyebrow">Mål uppnått</p>
            <h2 className="celebrate__title" id="celebrate-title">
              Du nådde ända fram!
            </h2>
            <p className="celebrate__text">
              <strong>{goal.name}</strong> är fullsparat – {formatSek(goal.balanceOre)} av{' '}
              {formatSek(goal.targetAmountOre)}. Jag har något till dig.
            </p>
            <div className="celebrate__actions">
              <Button onClick={openPresent} icon="gift">
                Öppna presenten
              </Button>
              <Button variant="ghost" onClick={close}>
                Senare
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="celebrate__eyebrow">Grattis!</p>
            <h2 className="celebrate__title" id="celebrate-title">
              Målet är i hamn 🎉
            </h2>
            <p className="celebrate__text">
              {formatSek(goal.balanceOre)} sparade till <strong>{goal.name}</strong>. Varje litet steg räknas –
              det här var många.
            </p>
            <div className="celebrate__actions">
              <Button onClick={close}>Fira klart</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
