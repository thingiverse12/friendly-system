import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, ApiError } from '../api';
import type { Goal, Transaction } from '../types';
import { formatSek, fromDateInput, parseSekToOre, toDateInput } from '../format';
import { useToast } from '../toast';
import { Icon } from './Icon';
import { Button, Field, SelectField, TextArea, TextField } from './UI';

const INCOME_CATEGORIES = ['Lön', 'Bidrag', 'Återbäring', 'Övrig inkomst'];
const EXPENSE_CATEGORIES = ['Mat', 'Boende', 'Transport', 'Nöje', 'Hälsa', 'Shopping', 'Prenumerationer', 'Övrig utgift'];

function amountError(raw: string): string | null {
  if (!raw.trim()) return 'Ange ett belopp.';
  const ore = parseSekToOre(raw);
  if (ore === null) return 'Ange ett giltigt belopp, till exempel 1250 eller 1250,50.';
  if (ore <= 0) return 'Beloppet måste vara större än 0.';
  if (ore > 1_000_000_000_00) return 'Beloppet är för stort.';
  return null;
}

export function useFormError() {
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const reset = () => {
    setError(null);
    setFieldErrors({});
  };
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
  return { error, fieldErrors, reset, capture };
}

/* --------------------------------- goals --------------------------------- */

export function GoalForm({
  goal,
  onDone,
  onCancel,
}: {
  goal?: Goal;
  onDone: (goal: Goal) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(goal?.name ?? '');
  const [amount, setAmount] = useState(goal ? String(goal.targetAmountOre / 100).replace('.', ',') : '');
  const [privacy, setPrivacy] = useState<'private' | 'alias_visible'>(goal?.privacy ?? 'private');
  const [saving, setSaving] = useState(false);
  const { error, fieldErrors, reset, capture } = useFormError();
  const { push } = useToast();

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    reset();
    const ore = parseSekToOre(amount);
    const localErrors: Record<string, string> = {};
    if (!name.trim()) localErrors.name = 'Ge sparmålet ett namn.';
    const amountIssue = amountError(amount);
    if (amountIssue) localErrors.targetAmountOre = amountIssue;
    if (Object.keys(localErrors).length > 0) {
      capture(new ApiError(422, 'validation_error', Object.values(localErrors)[0]!, Object.entries(localErrors).map(([field, message]) => ({ field, message }))));
      return;
    }
    setSaving(true);
    try {
      if (goal) {
        const result = await api.updateGoal(goal.id, {
          name: name.trim(),
          ...(goal.lockedTarget ? {} : { targetAmountOre: ore! }),
          privacy,
        });
        push('Sparmålet är uppdaterat.');
        onDone(result.goal);
      } else {
        const result = await api.createGoal({ name: name.trim(), targetAmountOre: ore!, privacy });
        push('Sparmålet är skapat. Dags att sätta första stenen!');
        onDone(result.goal);
      }
    } catch (caught) {
      capture(caught);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="stack" onSubmit={onSubmit} noValidate>
      {error ? (
        <div className="banner banner--error" role="alert">
          <span className="banner__icon">!</span>
          <div>{error}</div>
        </div>
      ) : null}
      <TextField
        label="Namn på sparmålet"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Till exempel Drömresan"
        maxLength={80}
        required
        error={fieldErrors.name}
        autoComplete="off"
      />
      <Field label="Målbelopp" htmlFor="goal-amount" required error={fieldErrors.targetAmountOre} hint={goal?.lockedTarget ? 'Målbeloppet är låst medan tävlingen pågår.' : 'Ange belopp i kronor, till exempel 25000.'}>
        <div className="amount-input-wrap">
          <input
            id="goal-amount"
            className="input"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="25 000"
            disabled={goal?.lockedTarget}
            aria-invalid={Boolean(fieldErrors.targetAmountOre)}
          />
          <span className="amount-input-wrap__suffix">kr</span>
        </div>
      </Field>
      <SelectField
        label="Integritet"
        value={privacy}
        onChange={(event) => setPrivacy(event.target.value as 'private' | 'alias_visible')}
        hint="Ditt mål och dina belopp visas aldrig för andra. Inställningen styr bara om målet kan kopplas till ditt alias i tävlingar."
      >
        <option value="private">Privat – syns bara för mig</option>
        <option value="alias_visible">Alias-synligt – visas med mitt alias</option>
      </SelectField>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 4 }}>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Avbryt
        </Button>
        <Button type="submit" loading={saving}>
          {goal ? 'Spara ändringar' : 'Skapa sparmål'}
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------- movements ------------------------------- */

export function MovementForm({
  goal,
  initialType = 'deposit',
  onDone,
  onCancel,
}: {
  goal: Goal;
  initialType?: 'deposit' | 'withdrawal';
  onDone: (goal: Goal, earned: string[]) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<'deposit' | 'withdrawal'>(initialType);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const { error, fieldErrors, reset, capture } = useFormError();
  const { push } = useToast();

  const ore = parseSekToOre(amount);
  const preview = useMemo(() => {
    if (ore === null) return null;
    const next = type === 'deposit' ? goal.balanceOre + ore : goal.balanceOre - ore;
    return next;
  }, [ore, type, goal.balanceOre]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    reset();
    const issue = amountError(amount);
    if (issue) {
      capture(new ApiError(422, 'validation_error', issue, [{ field: 'amountOre', message: issue }]));
      return;
    }
    if (type === 'withdrawal' && ore! > goal.balanceOre) {
      capture(new ApiError(422, 'validation_error', 'Du kan inte ta ut mer än vad som finns sparat.', [
        { field: 'amountOre', message: 'Uttaget är större än saldot.' },
      ]));
      return;
    }
    setSaving(true);
    try {
      const result = await api.addMovement(goal.id, {
        type,
        amountOre: ore!,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      push(
        type === 'deposit'
          ? `${formatSek(ore!)} insatt i ${goal.name}.`
          : `${formatSek(ore!)} uttaget från ${goal.name}.`,
      );
      for (const achievement of result.newlyEarned) {
        push(`Ny bedrift: ${achievement.badge} ${achievement.name}`, 'success');
      }
      onDone(result.goal, result.newlyEarned.map((award) => award.code));
    } catch (caught) {
      capture(caught);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="stack" onSubmit={onSubmit} noValidate>
      <div className="type-switch" role="group" aria-label="Typ av rörelse">
        <button
          type="button"
          data-type="income"
          className={`type-switch__item ${type === 'deposit' ? 'is-active' : ''}`}
          onClick={() => setType('deposit')}
          aria-pressed={type === 'deposit'}
        >
          Sätt in
        </button>
        <button
          type="button"
          data-type="expense"
          className={`type-switch__item ${type === 'withdrawal' ? 'is-active' : ''}`}
          onClick={() => setType('withdrawal')}
          aria-pressed={type === 'withdrawal'}
        >
          Ta ut
        </button>
      </div>
      {error ? (
        <div className="banner banner--error" role="alert">
          <span className="banner__icon">!</span>
          <div>{error}</div>
        </div>
      ) : null}
      <Field label="Belopp" htmlFor="movement-amount" required error={fieldErrors.amountOre}>
        <div className="amount-input-wrap">
          <input
            id="movement-amount"
            className="input"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0,00"
            autoFocus
            aria-invalid={Boolean(fieldErrors.amountOre)}
          />
          <span className="amount-input-wrap__suffix">kr</span>
        </div>
      </Field>
      <div className="row row--between small muted">
        <span>Saldo idag: {formatSek(goal.balanceOre)}</span>
        {preview !== null ? (
          <span>
            Efter: <strong className={preview < 0 ? 'text-danger' : 'text-emerald'}>{formatSek(preview)}</strong>
          </span>
        ) : null}
      </div>
      <TextArea
        label="Anteckning"
        optionalLabel="(valfritt)"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        maxLength={280}
        placeholder="Till exempel: månadssparande"
      />
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Avbryt
        </Button>
        <Button type="submit" loading={saving} icon={type === 'deposit' ? 'arrowDownLeft' : 'arrowUpRight'}>
          {type === 'deposit' ? 'Sätt in' : 'Ta ut'}
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------ transactions ----------------------------- */

export function TransactionForm({
  transaction,
  goals,
  defaultType = 'expense',
  onDone,
  onCancel,
}: {
  transaction?: Transaction;
  goals: Goal[];
  defaultType?: 'income' | 'expense';
  onDone: (transaction: Transaction) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<'income' | 'expense'>(transaction?.type ?? defaultType);
  const [amount, setAmount] = useState(transaction ? String(transaction.amountOre / 100).replace('.', ',') : '');
  const [category, setCategory] = useState(transaction?.category ?? (defaultType === 'income' ? 'Lön' : 'Mat'));
  const [description, setDescription] = useState(transaction?.description ?? '');
  const [goalId, setGoalId] = useState(transaction?.goalId ?? '');
  const [date, setDate] = useState(transaction ? toDateInput(transaction.occurredAt) : toDateInput(new Date().toISOString()));
  const [saving, setSaving] = useState(false);
  const { error, fieldErrors, reset, capture } = useFormError();
  const { push } = useToast();

  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  useEffect(() => {
    if (!categories.includes(category)) setCategory(categories[0]!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    reset();
    const issue = amountError(amount);
    if (issue) {
      capture(new ApiError(422, 'validation_error', issue, [{ field: 'amountOre', message: issue }]));
      return;
    }
    setSaving(true);
    try {
      const body = {
        type,
        amountOre: parseSekToOre(amount)!,
        category,
        description: description.trim() ? description.trim() : undefined,
        goalId: goalId || null,
        occurredAt: fromDateInput(date),
      };
      if (transaction) {
        const result = await api.updateTransaction(transaction.id, body);
        push('Transaktionen är uppdaterad.');
        onDone(result.transaction);
      } else {
        const result = await api.createTransaction(body);
        push('Transaktionen är sparad.');
        onDone(result.transaction);
      }
    } catch (caught) {
      capture(caught);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="stack" onSubmit={onSubmit} noValidate>
      <div className="type-switch" role="group" aria-label="Typ av transaktion">
        <button
          type="button"
          data-type="income"
          className={`type-switch__item ${type === 'income' ? 'is-active' : ''}`}
          onClick={() => setType('income')}
          aria-pressed={type === 'income'}
        >
          Inkomst
        </button>
        <button
          type="button"
          data-type="expense"
          className={`type-switch__item ${type === 'expense' ? 'is-active' : ''}`}
          onClick={() => setType('expense')}
          aria-pressed={type === 'expense'}
        >
          Utgift
        </button>
      </div>
      {error ? (
        <div className="banner banner--error" role="alert">
          <span className="banner__icon">!</span>
          <div>{error}</div>
        </div>
      ) : null}
      <Field label="Belopp" htmlFor="transaction-amount" required error={fieldErrors.amountOre}>
        <div className="amount-input-wrap">
          <input
            id="transaction-amount"
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
      <SelectField
        label="Kategori"
        value={category}
        onChange={(event) => setCategory(event.target.value)}
        error={fieldErrors.category}
      >
        {categories.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </SelectField>
      <TextField label="Datum" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
      <SelectField
        label="Koppla till sparmål"
        optionalLabel="(valfritt)"
        value={goalId}
        onChange={(event) => setGoalId(event.target.value)}
        hint="Kopplingen är bara en anteckning. Inkomster flyttas aldrig automatiskt till sparande."
      >
        <option value="">Inget sparmål</option>
        {goals.map((goal) => (
          <option key={goal.id} value={goal.id}>
            {goal.name}
          </option>
        ))}
      </SelectField>
      <TextArea
        label="Beskrivning"
        optionalLabel="(privat)"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        maxLength={280}
        placeholder="Endast du ser den här texten"
      />
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Avbryt
        </Button>
        <Button type="submit" loading={saving}>
          {transaction ? 'Spara ändringar' : 'Spara transaktion'}
        </Button>
      </div>
    </form>
  );
}

/* ---------------------------- invitation modal --------------------------- */

export function InvitationForm({
  groupId,
  onDone,
  onCancel,
}: {
  groupId: string;
  onDone: (code: string) => void;
  onCancel: () => void;
}) {
  const [maxUses, setMaxUses] = useState(1);
  const [expiresInHours, setExpiresInHours] = useState('168');
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const { error, fieldErrors, reset, capture } = useFormError();

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    reset();
    setSaving(true);
    try {
      const result = await api.createInvitation(groupId, {
        maxUses,
        expiresInHours: expiresInHours === 'never' ? null : Number(expiresInHours),
        ...(label.trim() ? { label: label.trim() } : {}),
      });
      onDone(result.invitation.code);
    } catch (caught) {
      capture(caught);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="stack" onSubmit={onSubmit} noValidate>
      {error ? (
        <div className="banner banner--error" role="alert">
          <span className="banner__icon">!</span>
          <div>{error}</div>
        </div>
      ) : null}
      <TextField
        label="Antal användningar"
        type="number"
        min={1}
        max={100}
        value={maxUses}
        onChange={(event) => setMaxUses(Number(event.target.value))}
        error={fieldErrors.maxUses}
        hint="Koden kan användas av högst så många personer."
        required
      />
      <SelectField label="Giltig i" value={expiresInHours} onChange={(event) => setExpiresInHours(event.target.value)}>
        <option value="24">24 timmar</option>
        <option value="72">3 dagar</option>
        <option value="168">7 dagar</option>
        <option value="720">30 dagar</option>
        <option value="never">Går inte ut</option>
      </SelectField>
      <TextField
        label="Etikett"
        optionalLabel="(valfritt)"
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        maxLength={40}
        placeholder="Till exempel: tjejresan"
        hint="Hjälper dig hålla ordning på dina inbjudningar."
      />
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Avbryt
        </Button>
        <Button type="submit" loading={saving} icon="link">
          Skapa kod
        </Button>
      </div>
    </form>
  );
}

export function CopyButton({ value, label = 'Kopiera' }: { value: string; label?: string }) {
  const { push } = useToast();
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          push('Kopierat till urklipp.', 'info');
        } catch {
          push('Kunde inte kopiera. Markera koden och kopiera manuellt.', 'error');
        }
      }}
    >
      <Icon name="copy" size={14} /> {label}
    </button>
  );
}
