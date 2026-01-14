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
          background: 'bg-emerald-50/80'
        };
      case 'error':
        return {
          icon: AlertTriangle,
          iconColor: 'text-red-600',
          border: 'border-red-200',
          background: 'bg-red-50/80'
        };
      default:
        return {
          icon: Info,
          iconColor: 'text-blue-600',
          border: 'border-blue-200',
          background: 'bg-blue-50/80'
        };
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm">
      {messages.map((msg) => {
        const styles = getVariantStyles(msg.type);
        const Icon = styles.icon;
        return (
          <div
            key={msg.id}
            className={`flex items-start gap-3 rounded-lg border ${styles.border} ${styles.background} px-4 py-3 shadow-lg text-sm text-foreground animate-fade-in-out`}
          >
            <Icon className={`mt-0.5 h-4 w-4 ${styles.iconColor}`} />
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{msg.text}</span>
                {msg.stage && (
                  <span className="rounded-full border border-border bg-white px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted">
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
              className="text-muted transition hover:text-foreground"
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
