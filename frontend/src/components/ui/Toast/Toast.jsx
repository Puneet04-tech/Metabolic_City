import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '../cn';
import styles from './Toast.module.css';

const ToastContext = createContext(null);

const TONE_ICON = {
  info: Info,
  success: CheckCircle2,
  warning: AlertCircle,
  error: AlertCircle,
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const counter = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (message, { tone = 'info', duration = 5000, title } = {}) => {
      counter.current += 1;
      const id = counter.current;
      setToasts((current) => [...current, { id, message, tone, title }]);
      if (duration > 0) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss]
  );

  const value = useMemo(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside a ToastProvider.');
  return context;
}

export function ToastViewport({ toasts = [], onDismiss }) {
  return (
    <div className={styles.viewport} role="region" aria-label="Notifications">
      <ol className={styles.list} aria-live="polite" aria-relevant="additions">
        {toasts.map((toast) => {
          const Icon = TONE_ICON[toast.tone] ?? Info;
          return (
            <li key={toast.id} className={cn(styles.toast)} data-tone={toast.tone}>
              <Icon className={styles.icon} size={16} aria-hidden="true" />
              <div className={styles.body}>
                {toast.title ? <p className={styles.title}>{toast.title}</p> : null}
                <p className={styles.message}>{toast.message}</p>
              </div>
              <button type="button" className={styles.dismiss} onClick={() => onDismiss(toast.id)} aria-label="Dismiss notification">
                <X size={14} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
