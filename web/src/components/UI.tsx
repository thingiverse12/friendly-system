import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Icon, type IconName } from './Icon';
import { EmptyIllustration } from './Illustrations';
import { Mascot } from './Mascot';

/* ------------------------------- progress ------------------------------- */

export function ProgressRing({
  valueBps,
  size = 132,
  stroke = 10,
  children,
  tone = 'emerald',
  label,
}: {
  valueBps: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
  tone?: 'emerald' | 'gold' | 'light';
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(10000, valueBps));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 10000);
  return (
    <div
      className={`ring ring--${tone}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? `Framsteg ${Math.round(clamped / 100)} procent`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="ring__track" cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} fill="none" />
        <circle
          className="ring__value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring__content">{children}</div>
    </div>
  );
}

export function ProgressBar({ valueBps, tone = 'emerald' }: { valueBps: number; tone?: 'emerald' | 'gold' }) {
  const clamped = Math.max(0, Math.min(10000, valueBps));
  return (
    <div
      className={`progress progress--${tone}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped / 100)}
    >
      <span className="progress__fill" style={{ width: `${clamped / 100}%` }} />
    </div>
  );
}

/* -------------------------------- forms -------------------------------- */

interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
  optionalLabel?: string;
}

export function Field({ label, htmlFor, hint, error, required, children, optionalLabel }: FieldProps) {
  return (
    <div className={`field ${error ? 'field--error' : ''}`}>
      <label className="field__label" htmlFor={htmlFor}>
        {label}
        {required ? <span className="field__required" aria-hidden="true"> *</span> : null}
        {optionalLabel ? <span className="field__optional">{optionalLabel}</span> : null}
      </label>
      {children}
      {hint && !error ? <p className="field__hint">{hint}</p> : null}
      {error ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({ label, hint, error, required, optionalLabel, ...props }: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  optionalLabel?: string;
}) {
  const autoId = useId();
  const id = props.id ?? autoId;
  return (
    <Field label={label} htmlFor={id} hint={hint} error={error} required={required} optionalLabel={optionalLabel}>
      <input
        {...props}
        id={id}
        className={`input ${props.className ?? ''}`}
        aria-invalid={Boolean(error)}
        aria-describedby={hint ? `${id}-hint` : undefined}
        required={required}
      />
    </Field>
  );
}

export function TextArea({ label, hint, error, optionalLabel, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  optionalLabel?: string;
}) {
  const autoId = useId();
  const id = props.id ?? autoId;
  return (
    <Field label={label} htmlFor={id} hint={hint} error={error} optionalLabel={optionalLabel}>
      <textarea {...props} id={id} className={`input input--area ${props.className ?? ''}`} aria-invalid={Boolean(error)} />
    </Field>
  );
}

export function SelectField({
  label,
  hint,
  error,
  children,
  optionalLabel,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  optionalLabel?: string;
}) {
  const autoId = useId();
  const id = props.id ?? autoId;
  return (
    <Field label={label} htmlFor={id} hint={hint} error={error} optionalLabel={optionalLabel}>
      <div className="select-wrap">
        <select {...props} id={id} className={`input input--select ${props.className ?? ''}`} aria-invalid={Boolean(error)}>
          {children}
        </select>
        <span className="select-wrap__chevron" aria-hidden="true">
          <Icon name="chevronRight" size={16} />
        </span>
      </div>
    </Field>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className={`toggle-row ${disabled ? 'is-disabled' : ''}`}>
      <div className="toggle-row__text">
        <label htmlFor={id} className="toggle-row__label">
          {label}
        </label>
        {description ? <p className="toggle-row__description">{description}</p> : null}
      </div>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        className={`switch ${checked ? 'switch--on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className="switch__thumb" />
      </button>
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: Array<{ value: T; label: string; count?: number }>;
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="tablist" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          className={`segmented__item ${value === option.value ? 'is-active' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {option.count !== undefined ? <span className="segmented__count">{option.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/* -------------------------------- pieces -------------------------------- */

export function Button({
  variant = 'primary',
  size,
  icon,
  children,
  loading,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold';
  size?: 'sm' | 'md';
  icon?: IconName;
  loading?: boolean;
}) {
  return (
    <button
      {...props}
      className={`btn btn--${variant} ${size === 'sm' ? 'btn--sm' : ''} ${props.className ?? ''}`}
      disabled={props.disabled || loading}
    >
      {loading ? <span className="spinner" aria-hidden="true" /> : icon ? <Icon name={icon} size={18} /> : null}
      <span>{children}</span>
    </button>
  );
}

export function SectionHeader({
  title,
  action,
  subtitle,
  id,
}: {
  title: string;
  action?: ReactNode;
  subtitle?: string;
  id?: string;
}) {
  return (
    <div className="section-header">
      <div>
        <h2 id={id} className="section-header__title">
          {title}
        </h2>
        {subtitle ? <p className="section-header__subtitle">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'emerald' | 'gold' | 'navy' | 'danger' }) {
  return <span className={`pill pill--${tone}`}>{children}</span>;
}

export function Banner({
  tone = 'info',
  title,
  children,
  icon = 'info',
}: {
  tone?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  children?: ReactNode;
  icon?: IconName;
}) {
  return (
    <div className={`banner banner--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <span className="banner__icon">
        <Icon name={icon} size={18} />
      </span>
      <div>
        {title ? <p className="banner__title">{title}</p> : null}
        {children ? <div className="banner__body">{children}</div> : null}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  variant = 'goal',
  mascot = false,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  variant?: 'goal' | 'trophy' | 'receipt';
  /** Show the Sparly dog instead of the abstract illustration. */
  mascot?: boolean;
}) {
  return (
    <div className="empty-state">
      {mascot ? <Mascot variant="face" size={136} className="empty-state__mascot" /> : <EmptyIllustration variant={variant} />}
      <h3>{title}</h3>
      <p>{description}</p>
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error-state" role="alert">
      <span className="error-state__icon" aria-hidden="true">!</span>
      <div>
        <h3>Något gick fel</h3>
        <p>{message}</p>
      </div>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          Försök igen
        </Button>
      ) : null}
    </div>
  );
}

export function Skeleton({ lines = 3, hero = false }: { lines?: number; hero?: boolean }) {
  return (
    <div className="skeleton" aria-hidden="true">
      {hero ? <div className="skeleton__hero" /> : null}
      {Array.from({ length: lines }).map((_, index) => (
        <div key={index} className="skeleton__line" style={{ width: `${92 - index * 12}%` }} />
      ))}
    </div>
  );
}

export function LoadingBlock({ label = 'Laddar …' }: { label?: string }) {
  return (
    <div className="loading-block" role="status" aria-live="polite">
      <span className="spinner spinner--dark" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

/* -------------------------------- modal -------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'default',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'default' | 'wide';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const node = ref.current;
    const focusable = node?.querySelector<HTMLElement>(
      'input:not([type="hidden"]), select, textarea, button, [href], [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
      if (event.key !== 'Tab' || !node) return;
      const items = Array.from(
        node.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'),
      ).filter((item) => item.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        className={`modal ${size === 'wide' ? 'modal--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        ref={ref}
      >
        <div className="modal__header">
          <div>
            <h2 id={titleId} className="modal__title">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="modal__description">
                {description}
              </p>
            ) : null}
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Stäng">
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer ? <div className="modal__footer">{footer}</div> : null}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Bekräfta',
  danger,
  loading,
  onConfirm,
  onCancel,
  children,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Avbryt
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="confirm-message">{message}</p>
      {children}
    </Modal>
  );
}
