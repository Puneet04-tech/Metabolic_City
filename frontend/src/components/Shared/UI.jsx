import { useState, useEffect } from 'react';

/**
 * Reusable KPI card with optional trend arrow and glow accent.
 */
export function KPI({ label, value, trend, accent = 'primary', unit, subtitle }) {
  const trendColor = trend > 0 ? 'var(--success)' : trend < 0 ? 'var(--error)' : 'var(--text-muted)';
  const arrow = trend > 0 ? '▲' : trend < 0 ? '▼' : '•';

  return (
    <div className={`kpi-card kpi-${accent}`}>
      <span className="kpi-label">{label}</span>
      <div className="kpi-value">
        {value}
        {unit && <span className="kpi-unit">{unit}</span>}
      </div>
      {subtitle && <span className="kpi-subtitle">{subtitle}</span>}
      {trend !== undefined && (
        <span className="kpi-trend" style={{ color: trendColor }}>
          {arrow} {Math.abs(trend).toFixed(1)}%
        </span>
      )}
    </div>
  );
}

/**
 * Glassmorphism card wrapper with optional header + footer.
 */
export function Card({ title, headerExtra, footer, accent, children, className = '' }) {
  return (
    <div className={`card${className ? ' ' + className : ''}`}>
      {(title || headerExtra) && (
        <div className="card-head">
          {title && <h3>{title}</h3>}
          {headerExtra && <div className="card-head-extra">{headerExtra}</div>}
        </div>
      )}
      <div className="card-body">{children}</div>
      {footer && <div className="card-foot">{footer}</div>}
    </div>
  );
}

/**
 * Status pill with color-coded state.
 */
export function Pill({ status, label }) {
  const map = {
    CRITICAL: 'error',
    HIGH: 'warning',
    MODERATE: 'info',
    LOW: 'success',
    live: 'success',
    degraded: 'error',
    connecting: 'warning',
    online: 'success',
    offline: 'error',
  };
  const cls = map[status] || 'info';
  return <span className={`pill pill-${cls}`}>{label || status}</span>;
}

/**
 * Segmented control / tab bar.
 */
export function Segmented({ options, value, onChange }) {
  return (
    <div className="segmented">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={value === opt.value ? 'segmented-btn active' : 'segmented-btn'}
          onClick={() => onChange(opt.value)}
        >
          {opt.icon && <span className="segmented-icon">{opt.icon}</span>}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Skeleton loader for cards / lists.
 */
export function Skeleton({ count = 3, height = 80, className = '' }) {
  return (
    <div className={`skeleton-list ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-bar" style={{ height }} />
      ))}
    </div>
  );
}

/**
 * Empty state with icon + message + optional action.
 */
export function EmptyState({ icon, title, description, action }) {
  return (
    <div className="empty-state-card">
      {icon && <div className="empty-state-icon">{icon}</div>}
      <h4>{title}</h4>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

/**
 * Toast notification container (renders at root). Lightweight alternative to react-hot-toast.
 */
export function useToast() {
  const [toasts, setToasts] = useState([]);

  const push = (message, type = 'info', duration = 4000) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration);
  };

  const ToastContainer = () => (
    <div className="toast-container" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span className="toast-dot" />
          {t.message}
        </div>
      ))}
    </div>
  );

  return { push, ToastContainer };
}

/**
 * Copy-to-clipboard helper button.
 */
export function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="copy-btn"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* ignore */
        }
      }}
    >
      {copied ? 'Copied!' : label}
    </button>
  );
}

export default { KPI, Card, Pill, Segmented, Skeleton, EmptyState, useToast, CopyButton };