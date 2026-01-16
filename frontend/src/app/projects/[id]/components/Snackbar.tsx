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
          iconColor: 'text-emerald-600',
          border: 'border-emerald-200',
          background: 'bg-emerald-50/95'
        };
      case 'error':
        return {
          icon: AlertTriangle,
          iconColor: 'text-red-600',
          border: 'border-red-200',
          background: 'bg-red-50/95'
        };
      default:
        return {
          icon: Info,
          iconColor: 'text-blue-600',
          border: 'border-blue-200',
          background: 'bg-blue-50/95'
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
            className={`pointer-events-auto flex items-start gap-3 rounded-lg border ${styles.border} ${styles.background} px-4 py-3 shadow-xl ring-1 ring-black/5 backdrop-blur-sm text-ui-body text-foreground animate-fade-in-out`}
          >
            <Icon className={`mt-0.5 h-4 w-4 ${styles.iconColor}`} />
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{msg.text}</span>
                {msg.stage && (
                  <span className="rounded-full border border-border bg-white/90 px-2 py-0.5 text-ui-size-meta uppercase tracking-wide text-muted">
                    {msg.stage}
                  </span>
                )}
              </div>
              {msg.description && (
                <p className="mt-1 text-ui-muted">{msg.description}</p>
              )}
            </div>
            <button
              onClick={() => onClose(msg.id)}
              className="-mr-1 -mt-1 rounded-md p-1 text-muted transition hover:bg-white/60 hover:text-foreground"
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
