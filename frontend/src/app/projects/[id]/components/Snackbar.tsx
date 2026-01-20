import React from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { SnackbarMessage } from './types';

/**
 * M3 Snackbar Specifications:
 * - Min width: 344dp
 * - Max width: 672dp (desktop)
 * - Height: 48dp (single-line), 68dp (two-line)
 * - Corner radius: 4dp
 * - Horizontal margin: 8dp from screen edge
 * - Bottom margin: 8dp
 * - Internal padding: 16dp
 * - Text style: Body Medium
 * - Action text style: Label Large
 * - Action color: Inverse Primary
 * - Background: Inverse Surface
 * - Text color: Inverse On Surface
 */

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
          iconColor: 'text-success',
          containerClass: 'bg-success-container text-on-success-container',
        };
      case 'error':
        return {
          icon: AlertTriangle,
          iconColor: 'text-error',
          containerClass: 'bg-error-container text-on-error-container',
        };
      default:
        return {
          icon: Info,
          iconColor: 'text-inverse-primary',
          containerClass: 'bg-inverse-surface text-inverse-on-surface',
        };
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none sm:left-auto sm:right-6 sm:translate-x-0 sm:bottom-6">
      {messages.map((msg) => {
        const styles = getVariantStyles(msg.type);
        const Icon = styles.icon;
        const hasDescription = !!msg.description;

        return (
          <div
            key={msg.id}
            className={cn(
              // Pointer events
              "pointer-events-auto",
              // M3 snackbar layout
              "flex items-start gap-3",
              // M3 sizing
              "min-w-[344px] max-w-[672px]",
              hasDescription ? "min-h-[68px] py-3" : "min-h-[48px] py-3",
              // M3 corner radius: 4dp
              "rounded-[4px]",
              // M3 padding
              "px-4",
              // M3 elevation (snackbar should float)
              "shadow-[0_4px_8px_3px_rgba(0,0,0,0.15),0_1px_3px_rgba(0,0,0,0.3)]",
              // M3 colors
              styles.containerClass,
              // Animation
              "animate-m3-slide-in-bottom"
            )}
            role="alert"
          >
            {/* Icon */}
            <Icon className={cn("mt-0.5 h-5 w-5 flex-shrink-0", styles.iconColor)} />

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {/* M3 Body Medium typography */}
                <span className="text-body-medium font-medium">{msg.text}</span>
                {msg.stage && (
                  <span className={cn(
                    "rounded-full px-2 py-0.5",
                    "text-label-small",
                    "bg-surface-container-highest/20"
                  )}>
                    {msg.stage}
                  </span>
                )}
              </div>
              {msg.description && (
                <p className="mt-1 text-body-small opacity-80">{msg.description}</p>
              )}
            </div>

            {/* Close button - M3 icon button style */}
            <button
              onClick={() => onClose(msg.id)}
              className={cn(
                "flex-shrink-0 -mr-2 -mt-1",
                "p-2 rounded-full",
                "transition-colors duration-200",
                "hover:bg-[color-mix(in_srgb,currentColor_8%,transparent)]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse-primary"
              )}
              aria-label="Dismiss notification"
              type="button"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

// Single Snackbar component for simple use cases
interface SingleSnackbarProps {
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  onClose?: () => void;
  variant?: 'default' | 'success' | 'error';
  duration?: number;
}

export const SingleSnackbar: React.FC<SingleSnackbarProps> = ({
  message,
  action,
  onClose,
  variant = 'default',
}) => {
  const variantClasses = {
    default: 'bg-inverse-surface text-inverse-on-surface',
    success: 'bg-success-container text-on-success-container',
    error: 'bg-error-container text-on-error-container',
  };

  return (
    <div
      className={cn(
        // M3 snackbar layout
        "flex items-center gap-2",
        // M3 sizing
        "min-w-[344px] max-w-[672px] min-h-[48px]",
        // M3 corner radius: 4dp
        "rounded-[4px]",
        // M3 padding
        "px-4 py-2",
        // M3 elevation
        "shadow-[0_4px_8px_3px_rgba(0,0,0,0.15),0_1px_3px_rgba(0,0,0,0.3)]",
        // Colors
        variantClasses[variant]
      )}
      role="alert"
    >
      {/* Message */}
      <span className="flex-1 text-body-medium">{message}</span>

      {/* Action button */}
      {action && (
        <button
          onClick={action.onClick}
          className={cn(
            "text-label-large font-medium",
            "text-inverse-primary",
            "hover:opacity-80",
            "focus-visible:outline-none focus-visible:underline",
            "transition-opacity duration-200"
          )}
          type="button"
        >
          {action.label}
        </button>
      )}

      {/* Close button (optional) */}
      {onClose && (
        <button
          onClick={onClose}
          className={cn(
            "p-1 rounded-full -mr-1",
            "hover:bg-[color-mix(in_srgb,currentColor_8%,transparent)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse-primary"
          )}
          aria-label="Dismiss"
          type="button"
        >
          <X className="h-5 w-5" />
        </button>
      )}
    </div>
  );
};
