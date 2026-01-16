import React from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { SnackbarMessage } from './types';

interface SnackbarProps {
  messages: SnackbarMessage[];
  onClose: (id: number) => void;
}

export const Snackbar: React.FC<SnackbarProps> = ({ messages, onClose }) => {
  const getVariantStyles = (type: SnackbarMessage['type']) => {
    switch (type) {
      case 'success':
        return {
          icon: CheckCircle2,
          iconColor: 'text-emerald-600 dark:text-emerald-400',
          border: 'border-emerald-200 dark:border-emerald-800',
          background: 'bg-emerald-50/95 dark:bg-emerald-950/95'
        };
      case 'error':
        return {
          icon: AlertTriangle,
          iconColor: 'text-red-600 dark:text-red-400',
          border: 'border-red-200 dark:border-red-800',
          background: 'bg-red-50/95 dark:bg-red-950/95'
        };
      default:
        return {
          icon: Info,
          iconColor: 'text-blue-600 dark:text-blue-400',
          border: 'border-blue-200 dark:border-blue-800',
          background: 'bg-blue-50/95 dark:bg-blue-950/95'
        };
    }
  };

  return (
    <div className="fixed top-24 right-4 z-50 flex max-w-sm flex-col gap-3 pointer-events-none sm:right-6 lg:top-20">
      {messages.map((msg) => {
        const styles = getVariantStyles(msg.type);
        const Icon = styles.icon;
        return (
          <div
            key={msg.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-lg border ${styles.border} ${styles.background} px-4 py-3 shadow-xl ring-1 ring-black/5 backdrop-blur-sm text-sm text-foreground animate-fade-in-out`}
          >
            <Icon className={`mt-0.5 h-4 w-4 ${styles.iconColor}`} />
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{msg.text}</span>
                {msg.stage && (
                  <span className="rounded-full border border-border bg-white/90 dark:bg-surface-strong/90 px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted">
                    {msg.stage}
                  </span>
                )}
              </div>
              {msg.description && (
                <p className="mt-1 text-xs text-muted">{msg.description}</p>
              )}
            </div>
            <button
              onClick={() => onClose(msg.id)}
              className="-mr-1 -mt-1 rounded-md p-1 text-muted transition hover:bg-white/60 dark:hover:bg-surface-strong/60 hover:text-foreground"
              aria-label="Dismiss notification"
              type="button"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
