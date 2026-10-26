import { useMemo, useState } from 'react';
import type { RecurrenceInterval, RecurringRule, TransactionType } from '../types';
import { api } from '../api';
import { formatSek } from '../format';
import { Icon } from './Icon';
import { Button, Field, Pill, SelectField, TextField } from './UI';
import { useFormError } from './Forms';
import { useToast } from '../toast';

/**
 * Återkommande inkomster och utgifter.
 *
 * Regeln beskriver bara *när* pengarna rör sig – varje bokförd gång blir en vanlig transaktion, så
 * översikter och månadssummor fortsätter att ha en enda källa till sanning.
 */

export const WEEKDAYS = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'];
const MONTHS = [
  'januari',
  'februari',
  'mars',
  'april',
  'maj',
  'juni',
  'juli',
  'augusti',
  'september',
  'oktober',
  'november',
  'december',
 ];

const INCOME_CATEGORIES = ['Lön', 'Bidrag', 'Återbäring', 'Övrig inkomst'];
const EXPENSE_CATEGORIES = ['Mat', 'Boende', 'Transport', 'Nöje', 'Hälsa', 'Shopping', 'Prenumerationer', 'Övrig utgift'];

const INTERVAL_OPTIONS: Array<{ value: RecurrenceInterval; label: string; chip: string }> = [
  { value: 'monthly', label: 'Varje månad', chip: 'Månadsvis' },
  { value: 'weekly', label: 'Varje vecka', chip: 'Veckovis' },
  { value: 'quarterly', label: 'Varje kvartal', chip: 'Kvartalsvis' },
  { value: 'yearly', label: 'Varje år', chip: 'Årligen' },
];

export function intervalLabel(interval: RecurrenceInterval): string {
  return INTERVAL_OPTIONS.find((option) => option.value === interval)?.chip ?? 'Månadsvis';
}

/** Ordinal in Swedish: 1 → "1:a", 22 → "22:a", 3 → "3:e". */
export function ordinal(day: number): string {
  if (day === 1 || day === 2 || day === 21 || day === 22 || day === 31) return `${day}:a`;
  return `${day}:e`;
}

export function formatDateOnly(date: string | null, style: 'short' | 'long' = 'short'): string {
  if (!date) return '—';
  const parsed = new Date(`${date}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat('sv-SE', {
    day: 'numeric',
    month: style === 'long' ? 'long' : 'short',
    ...(style === 'long' ? { year: 'numeric' } : {}),
    timeZone: 'Europe/Stockholm',
  }).format(parsed);
}

/** "Den 25:e varje månad", "Varje måndag", "Den 12:e varje kvartal", "Den 1 juni varje år". */
export function scheduleLabel(rule: Pick<RecurringRule, 'interval' | 'dayOfMonth' | 'weekday' | 'startDate'>): string {
  const day = rule.dayOfMonth ?? Number(rule.startDate.slice(8, 10));
  switch (rule.interval) {
    case 'weekly':
      return `Varje ${(WEEKDAYS[(rule.weekday ?? 1) - 1] ?? 'måndag').toLowerCase()}`;
    case 'quarterly':
      return `Den ${ordinal(day)} varje kvartal`;
    case 'yearly': {
      const month = Number(rule.startDate.slice(5, 7));
      return `${day} ${MONTHS[month - 1] ?? ''} varje år`.trim();
    }
    default:
      return `Den ${ordinal(day)} varje månad`;
  }
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/* ----------------------------------- form --------------------------------- */

export function RecurringForm({
  rule,
  defaultType = 'expense',
  onDone,
  onCancel,
}: {
  rule?: RecurringRule;
  defaultType?: TransactionType;
  onDone: (rule: RecurringRule) => void;
  onCancel: () => void;
}) {
  const { push } = useToast();
  const [type, setType] = useState<TransactionType>(rule?.type ?? defaultType);
  const [amount, setAmount] = useState(rule ? String(rule.amountOre / 100).replace('.', ',') : '');
  const [category, setCategory] = useState(rule?.category ?? (defaultType === 'income' ? 'Lön' : 'Boende'));
  const [interval, setInterval] = useState<RecurrenceInterval>(rule?.interval ?? 'monthly');
  const [dayOfMonth, setDayOfMonth] = useState(String(rule?.dayOfMonth ?? new Date().getDate()));
  const [weekday, setWeekday] = useState(String(rule?.weekday ?? 1));
  const [startDate, setStartDate] = useState(rule?.startDate ?? todayIso());
  const [endMonth, setEndMonth] = useState(rule?.endMonth ?? '');
  const [description, setDescription] = useState(rule?.description ?? '');
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const { error, fieldErrors, reset, capture } = useFormError();

  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const amountOre = useMemo(() => {
    const normalised = amount.replace(/\s/g, '').replace(',', '.');
    const value = Number(normalised);
    return Number.isFinite(value) ? Math.round(value * 100) : 0;
  }, [amount]);

  const monthlyPreview = useMemo(() => {
    if (!amountOre) return 0;
    if (interval === 'weekly') return Math.round((amountOre * 52) / 12);
    if (interval === 'quarterly') return Math.round(amountOre / 3);
    if (interval === 'yearly') return Math.round(amountOre / 12);
    return amountOre;
  }, [amountOre, interval]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    reset();
    setLocalError(null);
    if (!amountOre || amountOre <= 0) {
      setLocalError('Ange ett belopp större än 0.');
      return;
    }
    setSaving(true);
    try {
      const body = {
        type,
        amountOre,
        category,
        description: description.trim() || undefined,
        interval,
        startDate,
        ...(interval === 'weekly' ? { weekday: Number(weekday) } : { dayOfMonth: Number(dayOfMonth) }),
        endMonth: endMonth || null,
      };
      if (rule) {
        const result = await api.updateRecurring(rule.id, body);
        push('Den återkommande posten är uppdaterad.');
        onDone(result.rule);
      } else {
        const result = await api.createRecurring(body);
        push('Den återkommande posten är skapad.');
        onDone(result.rule);
      }
    } catch (caught) {
      capture(caught);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="stack" onSubmit={onSubmit} noValidate>
      <div className="type-switch" role="group" aria-label="Typ av post">
        <button
          type="button"
          data-type="income"
          className={`type-switch__item ${type === 'income' ? 'is-active' : ''}`}
          onClick={() => {
            setType('income');
            setCategory('Lön');
          }}
          aria-pressed={type === 'income'}
        >
          Inkomst
        </button>
        <button
          type="button"
          data-type="expense"
          className={`type-switch__item ${type === 'expense' ? 'is-active' : ''}`}
          onClick={() => {
            setType('expense');
            setCategory('Boende');
          }}
          aria-pressed={type === 'expense'}
        >
          Utgift
        </button>
      </div>

      {error || localError ? (
        <div className="banner banner--error" role="alert">
          <span className="banner__icon">!</span>
          <div>{error ?? localError}</div>
        </div>
      ) : null}

      <Field label="Belopp" htmlFor="recurring-amount" required error={fieldErrors.amountOre}>
        <div className="amount-input-wrap">
          <input
            id="recurring-amount"
            className="input"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0,00"
            aria-invalid={Boolean(fieldErrors.amountOre)}
          />
          <span className="amount-input-wrap__suffix">kr</span>
        </div>
      </Field>

      <SelectField label="Kategori" value={category} onChange={(event) => setCategory(event.target.value)} error={fieldErrors.category}>
        {categories.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </SelectField>

      <Field label="Upprepas" htmlFor="recurring-interval" required>
        <div className="segmented" role="group" aria-label="Upprepning">
          {INTERVAL_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`segmented__item ${interval === option.value ? 'is-active' : ''}`}
              aria-pressed={interval === option.value}
              onClick={() => setInterval(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </Field>

      {interval === 'weekly' ? (
        <SelectField
          label="Veckodag"
          value={weekday}
          onChange={(event) => setWeekday(event.target.value)}
          error={fieldErrors.weekday}
        >
          {WEEKDAYS.map((day, index) => (
            <option key={day} value={index + 1}>
              {day}
            </option>
          ))}
        </SelectField>
      ) : (
        <TextField
          label="Dag i månaden"
          type="number"
          min={1}
          max={31}
          value={dayOfMonth}
          onChange={(event) => setDayOfMonth(event.target.value)}
          error={fieldErrors.dayOfMonth}
          required
          hint={
            interval === 'yearly'
              ? 'Månaden bestäms av datumet nedan. Dagen finns inte i alla månader – då används månadens sista dag.'
              : 'Dagen finns inte i alla månader – då används månadens sista dag.'
          }
        />
      )}

      <div className="form-grid">
        <TextField
          label={rule ? 'Gäller från' : 'Första månaden gäller från'}
          type="date"
          value={startDate}
          onChange={(event) => setStartDate(event.target.value)}
          required
          error={fieldErrors.startDate}
        />
        <TextField
          label="Slutar"
          optionalLabel="(valfritt)"
          type="month"
          value={endMonth}
          onChange={(event) => setEndMonth(event.target.value)}
          error={fieldErrors.endMonth}
          hint="Lämna tomt för att den ska fortsätta tills du pausar den."
        />
      </div>

      <TextField
        label="Beskrivning"
        optionalLabel="(privat)"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        maxLength={280}
        placeholder="Till exempel Hyra, Netflix eller Månadspeng"
      />

      <p className="recurring-preview" aria-live="polite">
        <Icon name="calendar" size={15} />
        {amountOre > 0 ? (
          <>
            <span>
              <strong>{formatSek(amountOre)}</strong> {interval === 'weekly' ? 'i veckan' : interval === 'yearly' ? 'om året' : interval === 'quarterly' ? 'i kvartalet' : 'i månaden'}
            </span>
            {interval !== 'monthly' ? <span className="muted">≈ {formatSek(monthlyPreview)}/månad</span> : null}
          </>
        ) : (
          <span className="muted">Fyll i beloppet så räknar vi om det per månad.</span>
        )}
      </p>

      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Avbryt
        </Button>
        <Button type="submit" loading={saving}>
          {rule ? 'Spara ändringar' : 'Skapa återkommande'}
        </Button>
      </div>
    </form>
  );
}

/* ---------------------------------- pieces -------------------------------- */

export function RecurringRow({
  rule,
  onEdit,
  onToggle,
  onDelete,
  busy = false,
}: {
  rule: RecurringRule;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  busy?: boolean;
}) {
  return (
    <div className={`recurring-row ${rule.active ? '' : 'is-paused'}`}>
      <span className={`transaction-icon transaction-icon--${rule.type}`} aria-hidden="true">
        <Icon name={rule.type === 'income' ? 'arrowDownLeft' : 'arrowUpRight'} size={16} />
      </span>
      <div className="recurring-row__body">
        <span className="recurring-row__title">
          {rule.description?.trim() || rule.category}
          <Pill tone={rule.active ? 'emerald' : 'neutral'}>{rule.active ? intervalLabel(rule.interval) : 'Pausad'}</Pill>
        </span>
        <span className="recurring-row__meta">
          {scheduleLabel(rule)}
          {rule.active && rule.nextOccurrence ? ` · nästa ${formatDateOnly(rule.nextOccurrence)}` : ''}
          {rule.endMonth ? ` · till och med ${formatDateOnly(`${rule.endMonth}-01`, 'long')}` : ''}
        </span>
      </div>
      <div className="recurring-row__amounts">
        <span className={`transaction-row__amount transaction-row__amount--${rule.type}`}>
          {rule.type === 'income' ? '+' : '−'}
          {formatSek(rule.amountOre)}
        </span>
        {rule.interval !== 'monthly' ? (
          <span className="recurring-row__monthly">≈ {formatSek(rule.monthlyOre)}/mån</span>
        ) : null}
      </div>
      <div className="transaction-row__actions">
        <button type="button" className="row-menu-button" onClick={onEdit} aria-label={`Redigera ${rule.category}`}>
          <Icon name="edit" size={17} />
        </button>
        <button
          type="button"
          className="row-menu-button"
          onClick={onToggle}
          disabled={busy}
          aria-label={rule.active ? `Pausa ${rule.category}` : `Återuppta ${rule.category}`}
        >
          <Icon name={rule.active ? 'pause' : 'play'} size={17} />
        </button>
        <button type="button" className="row-menu-button" onClick={onDelete} aria-label={`Ta bort ${rule.category}`}>
          <Icon name="trash" size={17} />
        </button>
      </div>
    </div>
  );
}

/** Kompakt månadssiffra för översikten: vad de återkommande posterna kostar i snitt per månad. */
export function RecurringCard({
  activeCount,
  monthlyExpenseOre,
  monthlyIncomeOre,
  nextDate,
}: {
  activeCount: number;
  monthlyExpenseOre: number;
  monthlyIncomeOre: number;
  nextDate: string | null;
}) {
  return (
    <section className="card card--pad recurring-card" aria-labelledby="recurring-card-title">
      <span className="recurring-card__icon" aria-hidden="true">
        <Icon name="calendar" size={18} />
      </span>
      <div className="grow">
        <p className="recurring-card__title" id="recurring-card-title">
          Återkommande per månad
        </p>
        <p className="recurring-card__amount">{formatSek(monthlyExpenseOre)}</p>
        <p className="recurring-card__meta">
          {activeCount === 0
            ? 'Inga återkommande poster än – lägg in hyra, abonnemang och lön.'
            : `${activeCount} ${activeCount === 1 ? 'post' : 'poster'} igång` +
              (monthlyIncomeOre > 0 ? ` · ${formatSek(monthlyIncomeOre)} in` : '') +
              (nextDate ? ` · nästa ${formatDateOnly(nextDate)}` : '')}
        </p>
      </div>
    </section>
  );
}

