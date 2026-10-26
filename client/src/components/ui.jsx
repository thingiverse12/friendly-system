import { createContext, useCallback, useContext, useState } from 'react';
import { SOURCE_STATUS, CONNECTION_TYPES, CASE_TYPES, ENVIRONMENTS, DIFFICULTIES } from '../../../shared/constants.js';

export function Avatar({ name, initials, color, size = '' }) {
  return (
    <span className={`avatar ${size === 'lg' ? 'avatar-lg' : size === 'sm' ? 'avatar-sm' : ''}`}
      style={{ background: color || '#33414f' }} aria-hidden="true">
      {initials || name?.split(' ').map((w) => w[0]).slice(0, 2).join('')}
    </span>
  );
}

export function SourceBadge({ status }) {
  const s = SOURCE_STATUS[status];
  if (!s) return null;
  return <span className={`badge source-${status}`} title="Källstatus">{s.label}</span>;
}

export function ConnectionBadge({ type }) {
  const c = CONNECTION_TYPES[type];
  if (!c) return null;
  return <span className="badge" style={{ color: c.color, borderColor: c.color + '55' }}>{c.label}</span>;
}

export function DifficultyBadge({ id }) {
  const d = DIFFICULTIES[id];
  const cls = id === 'beginner' ? 'badge-green' : id === 'normal' ? 'badge-blue' : id === 'hard' ? 'badge-amber' : 'badge-red';
  return d ? <span className={`badge ${cls}`}>{d.label}</span> : null;
}

export function TypeLabel({ type }) { return CASE_TYPES[type] || type; }
export function EnvLabel({ env }) { return ENVIRONMENTS[env] || env; }

export function Spinner() {
  return <div className="center-loading" role="status" aria-label="Laddar"><span className="spinner" /></div>;
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="empty-state card">
      <h3>{title}</h3>
      {children && <p className="muted">{children}</p>}
      {action}
    </div>
  );
}

export function Modal({ title, onClose, children, wide }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 className="tight">{title}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Stäng">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------- Toast ----------
const ToastCtx = createContext(null);
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, kind = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-wrap" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={`toast alert-${t.kind === 'error' ? 'error' : t.kind === 'success' ? 'success' : 'info'}`}>{t.message}</div>)}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

export function Stars({ value, count }) {
  return (
    <span className="stars" aria-label={`Betyg ${value ?? 0} av 5`}>
      <span aria-hidden="true" style={{ color: 'var(--amber)' }}>★</span> {value ?? '–'}
      {count != null && <span className="faint small"> ({count})</span>}
    </span>
  );
}

export function CaseImage({ src, title, className = '', style }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <div className={`case-img case-img-placeholder ${className}`} style={style} aria-hidden="true"><span>{title?.slice(0, 1) || 'M'}</span></div>;
  }
  return <img className={`case-img ${className}`} style={style} src={src} alt="" loading="lazy" onError={() => setFailed(true)} />;
}
