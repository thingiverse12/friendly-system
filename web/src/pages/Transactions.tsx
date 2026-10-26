import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useAsync, useDocumentTitle } from '../hooks';
import { useAuth } from '../auth';
import { useToast } from '../toast';
import { formatDate, formatSek } from '../format';
import { Icon } from '../components/Icon';
import { TransactionForm } from '../components/Forms';
import { RecurringForm, RecurringRow } from '../components/Recurring';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Modal,
  SectionHeader,
  SelectField,
  Skeleton,
} from '../components/UI';
import type { Goal, RecurringResponse, RecurringRule, Transaction } from '../types';

const CATEGORIES = [
  'Lön',
  'Bidrag',
  'Återbäring',
  'Övrig inkomst',
  'Mat',
  'Boende',
  'Transport',
  'Nöje',
  'Hälsa',
  'Shopping',
  'Prenumerationer',
  'Övrig utgift',
];

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function monthRange(month: string): { from: string; to: string } {
  const [year, monthIndex] = month.split('-').map(Number);
  const start = new Date(Date.UTC(year!, (monthIndex ?? 1) - 1, 1));
  const end = new Date(Date.UTC(year!, monthIndex ?? 1, 1));
  return { from: start.toISOString(), to: new Date(end.getTime() - 1).toISOString() };
}

export function Transactions() {
  useDocumentTitle('Transaktioner');
  const { user } = useAuth();
  const { push } = useToast();
  const [type, setType] = useState<'' | 'income' | 'expense'>('');
  const [category, setCategory] = useState('');
  const [month, setMonth] = useState(currentMonth());
  const [limit, setLimit] = useState(50);
  const [creating, setCreating] = useState<null | 'income' | 'expense'>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const [busy, setBusy] = useState(false);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RecurringRule | null>(null);
  const [deletingRule, setDeletingRule] = useState<RecurringRule | null>(null);

  const range = useMemo(() => monthRange(month), [month]);
  const listState = useAsync<{ items: Transaction[]; total: number }>(
    async () =>
      api.transactions({
        type: type || undefined,
        category: category || undefined,
        from: range.from,
        to: range.to,
        limit,
        offset: 0,
      }),
    [type, category, range.from, range.to, limit],
  );
  const summaryState = useAsync(async () => api.transactionSummary(month), [month]);
  const recurringState = useAsync<RecurringResponse>(async () => api.recurring(), []);
  const goalsState = useAsync<{ goals: Goal[]; totals: { savedOre: number; targetOre: number } }>(
    async () => api.goals(false),
    [],
  );

  const goals = goalsState.data?.goals ?? [];
  const recurring = recurringState.data;
  const rules = recurring?.rules ?? [];
  const items = listState.data?.items ?? [];
  const summary = summaryState.data;
  const grouped = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const item of items) {
      const key = item.occurredAt.slice(0, 10);
      const existing = map.get(key) ?? [];
      existing.push(item);
      map.set(key, existing);
    }
    return [...map.entries()];
  }, [items]);

  const afterChange = () => {
    setCreating(null);
    setEditing(null);
    listState.reload();
    summaryState.reload();
  };

  // The recurring call books whatever has come due; if it did, the list and the tiles are stale.
  const bookedNow = recurring?.booked ?? 0;
  useEffect(() => {
    if (bookedNow > 0) {
      listState.reload();
      summaryState.reload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookedNow]);

  const afterRuleChange = () => {
    setRecurringOpen(false);
    setEditingRule(null);
    // Registering a rule can book the current month, so the whole page is refreshed.
    recurringState.reload();
    listState.reload();
    summaryState.reload();
  };

  const toggleRule = async (rule: RecurringRule) => {
    setBusy(true);
    try {
      await api.updateRecurring(rule.id, { active: !rule.active });
      push(rule.active ? 'Posten är pausad. Historiken finns kvar.' : 'Posten är igång igen.');
      recurringState.reload();
    } catch (error) {
      push((error as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const removeRule = async () => {
    if (!deletingRule) return;
    setBusy(true);
    try {
      await api.deleteRecurring(deletingRule.id);
      push('Den återkommande posten är borttagen. Bokförda transaktioner ligger kvar.');
      setDeletingRule(null);
      recurringState.reload();
    } catch (error) {
      push((error as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const removeTransaction = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.deleteTransaction(deleting.id);
      push('Transaktionen är borttagen.');
      setDeleting(null);
      afterChange();
    } catch (error) {
      push((error as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1 className="page-head__title">Transaktioner</h1>
          <p className="page-head__subtitle">Håll koll på inkomster och utgifter. Din ekonomi, dina regler.</p>
        </div>
        <div className="page-head__actions">
          <Button icon="plus" onClick={() => setCreating('expense')}>
            Ny transaktion
          </Button>
        </div>
      </header>

      <div className="summary-grid">
        <div className="summary-tile">
          <span className="summary-tile__label">Inkomster</span>
          <span className="summary-tile__value stat-tile__value--income">{formatSek(summary?.incomeOre ?? 0)}</span>
        </div>
        <div className="summary-tile">
          <span className="summary-tile__label">Utgifter</span>
          <span className="summary-tile__value stat-tile__value--expense">{formatSek(summary?.expenseOre ?? 0)}</span>
        </div>
        <div className="summary-tile">
          <span className="summary-tile__label">Netto</span>
          <span className={`summary-tile__value ${(summary?.netOre ?? 0) >= 0 ? 'stat-tile__value--income' : 'stat-tile__value--expense'}`}>
            {formatSek(summary?.netOre ?? 0, { signed: true })}
          </span>
        </div>
      </div>

      <section className="card card--pad recurring" aria-labelledby="recurring-title">
        <SectionHeader
          id="recurring-title"
          title="Återkommande poster"
          subtitle="Hyra, abonnemang och lön som kommer tillbaka varje månad – bokförs automatiskt."
          action={
            <div className="recurring__totals">
              <span className="recurring__totals-label">Per månad</span>
              <span className="recurring__totals-value">{formatSek(recurring?.summary.monthlyExpenseOre ?? 0)}</span>
            </div>
          }
        />

        {recurringState.loading ? <Skeleton lines={2} /> : null}

        {rules.length === 0 && !recurringState.loading ? (
          <EmptyState
            variant="receipt"
            title="Inga återkommande poster än"
            description="Lägg in det som kommer tillbaka varje månad – då fylls månadens summor på av sig själva."
            action={
              <Button icon="plus" onClick={() => setRecurringOpen(true)}>
                Lägg till återkommande
              </Button>
            }
          />
        ) : null}

        {rules.length > 0 ? (
          <>
            <div className="recurring__list">
              {rules.map((rule) => (
                <RecurringRow
                  key={rule.id}
                  rule={rule}
                  busy={busy}
                  onEdit={() => setEditingRule(rule)}
                  onToggle={() => void toggleRule(rule)}
                  onDelete={() => setDeletingRule(rule)}
                />
              ))}
            </div>
            <div className="recurring__foot">
              <p className="recurring__note">
                {recurring && recurring.summary.activeCount > 0
                  ? `${recurring.summary.activeCount} igång` +
                    (recurring.summary.monthlyIncomeOre > 0 ? ` · ${formatSek(recurring.summary.monthlyIncomeOre)} in per månad` : '') +
                    ` · ${formatSek(recurring.summary.yearlyExpenseOre)} per år`
                  : 'Alla poster är pausade just nu.'}
              </p>
              <Button variant="secondary" icon="plus" onClick={() => setRecurringOpen(true)}>
                Ny återkommande
              </Button>
            </div>
            {recurring?.booked ? (
              <p className="recurring__booked" role="status">
                {recurring.booked === 1
                  ? '1 återkommande post bokfördes nu.'
                  : `${recurring.booked} återkommande poster bokfördes nu.`}{' '}
                {recurring.summary.bookedThisMonthCount > 0
                  ? `Den här månaden: ${formatSek(recurring.summary.bookedThisMonthOre)}.`
                  : ''}
              </p>
            ) : null}
          </>
        ) : null}
      </section>

      <div className="filter-bar">
        <SelectField label="Typ" value={type} onChange={(event) => setType(event.target.value as '' | 'income' | 'expense')}>
          <option value="">Alla</option>
          <option value="income">Inkomster</option>
          <option value="expense">Utgifter</option>
        </SelectField>
        <SelectField label="Kategori" value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="">Alla kategorier</option>
          {CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </SelectField>
        <SelectField label="Månad" value={month} onChange={(event) => setMonth(event.target.value)}>
          {Array.from({ length: 12 }).map((_, index) => {
            const date = new Date();
            date.setDate(1);
            date.setMonth(date.getMonth() - index);
            const value = date.toISOString().slice(0, 7);
            const label = new Intl.DateTimeFormat('sv-SE', { month: 'long', year: 'numeric' }).format(date);
            return (
              <option key={value} value={value}>
                {label.charAt(0).toUpperCase() + label.slice(1)}
              </option>
            );
          })}
        </SelectField>
      </div>

      {listState.loading ? <Skeleton lines={6} /> : null}
      {listState.error ? <ErrorState message={listState.error.message} onRetry={listState.reload} /> : null}

      {!listState.loading && listState.data ? (
        items.length === 0 ? (
          <div className="card">
            <EmptyState
              variant="receipt"
              title="Inga transaktioner här"
              description={
                type || category
                  ? 'Inga transaktioner matchar dina filter. Prova att rensa dem.'
                  : 'Logga din första inkomst eller utgift för att se din ekonomi svart på vitt.'
              }
              action={
                <Button icon="plus" onClick={() => setCreating('expense')}>
                  Lägg till transaktion
                </Button>
              }
            />
          </div>
        ) : (
          <section aria-labelledby="transaction-list-title" className="stack">
            <h2 id="transaction-list-title" className="visually-hidden">
              Transaktioner
            </h2>
            {grouped.map(([day, dayItems]) => {
              const dayTotal = dayItems.reduce(
                (sum, item) => sum + (item.type === 'income' ? item.amountOre : -item.amountOre),
                0,
              );
              return (
                <div key={day} className="transaction-day">
                  <div className="transaction-day__label">
                    <span>{formatDate(`${day}T12:00:00.000Z`, user?.profile.timezone)}</span>
                    <span className="numeric">{formatSek(dayTotal, { signed: true })}</span>
                  </div>
                  {dayItems.map((item) => (
                    <div key={item.id} className="transaction-row">
                      <span className={`transaction-icon transaction-icon--${item.type}`} aria-hidden="true">
                        {item.type === 'income' ? '↓' : '↑'}
                      </span>
                      <div className="transaction-row__body">
                        <span className="transaction-row__title">
                          {item.category}
                          {item.goalName ? <span className="pill pill--emerald">{item.goalName}</span> : null}
                        </span>
                        <span className="transaction-row__meta">
                          {item.description ? `${item.description} · ` : ''}
                          {item.type === 'income' ? 'Inkomst' : 'Utgift'}
                        </span>
                      </div>
                      <span className={`transaction-row__amount transaction-row__amount--${item.type}`}>
                        {item.type === 'income' ? '+' : '−'}
                        {formatSek(item.amountOre)}
                      </span>
                      <div className="transaction-row__actions">
                        <button
                          type="button"
                          className="row-menu-button"
                          onClick={() => setEditing(item)}
                          aria-label={`Redigera ${item.category} ${formatSek(item.amountOre)}`}
                        >
                          <Icon name="edit" size={17} />
                        </button>
                        <button
                          type="button"
                          className="row-menu-button"
                          onClick={() => setDeleting(item)}
                          aria-label={`Ta bort ${item.category} ${formatSek(item.amountOre)}`}
                        >
                          <Icon name="trash" size={17} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
            {listState.data.total > items.length ? (
              <div className="row" style={{ justifyContent: 'center' }}>
                <Button variant="secondary" onClick={() => setLimit((value) => value + 50)}>
                  Visa fler ({listState.data.total - items.length} kvar)
                </Button>
              </div>
            ) : null}
          </section>
        )
      ) : null}

      <Modal
        open={creating !== null}
        onClose={() => setCreating(null)}
        title={creating === 'income' ? 'Ny inkomst' : 'Ny utgift'}
        description="Välj typ, belopp och kategori."
      >
        <TransactionForm
          goals={goals}
          defaultType={creating ?? 'expense'}
          onCancel={() => setCreating(null)}
          onDone={() => afterChange()}
        />
      </Modal>

      <Modal
        open={recurringOpen}
        onClose={() => setRecurringOpen(false)}
        title="Ny återkommande post"
        description="Välj hur ofta den ska bokföras. Första gången sker alltid framåt i tiden – historiken rörs inte."
      >
        <RecurringForm
          defaultType="expense"
          onCancel={() => setRecurringOpen(false)}
          onDone={() => afterRuleChange()}
        />
      </Modal>

      <Modal open={editingRule !== null} onClose={() => setEditingRule(null)} title="Redigera återkommande post">
        {editingRule ? (
          <RecurringForm
            rule={editingRule}
            onCancel={() => setEditingRule(null)}
            onDone={() => afterRuleChange()}
          />
        ) : null}
      </Modal>

      <ConfirmDialog
        open={deletingRule !== null}
        title="Ta bort återkommande posten?"
        message={
          deletingRule
            ? `${deletingRule.description?.trim() || deletingRule.category} slutar bokföras. Transaktioner som redan skapats ligger kvar.`
            : ''
        }
        confirmLabel="Ta bort"
        danger
        loading={busy}
        onConfirm={removeRule}
        onCancel={() => setDeletingRule(null)}
      />

      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Redigera transaktion">
        {editing ? (
          <TransactionForm
            transaction={editing}
            goals={goals}
            onCancel={() => setEditing(null)}
            onDone={() => afterChange()}
          />
        ) : null}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Ta bort transaktionen?"
        message={
          deleting
            ? `${deleting.category} ${formatSek(deleting.amountOre)} tas bort permanent. Ditt sparande påverkas inte.`
            : ''
        }
        confirmLabel="Ta bort"
        danger
        loading={busy}
        onConfirm={removeTransaction}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
