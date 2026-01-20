import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { X } from "lucide-react";

/**
 * M3 Dialog Specifications:
 * - Width: 280dp - 560dp
 * - Corner radius: 28dp
 * - Padding: 24dp
 * - Elevation: Level 3 (6dp)
 * - Background: Surface Container Highest
 * - Scrim: 32% opacity
 */

interface ModalProps extends React.HTMLAttributes<HTMLDivElement> {
  open: boolean;
  onClose?: () => void;
  /** Dialog title */
  title?: string;
  /** Optional icon displayed above the title */
  icon?: React.ReactNode;
  /** Whether to show a close button */
  showCloseButton?: boolean;
  /** Size variant */
  size?: "sm" | "md" | "lg" | "full";
}

const sizeClasses = {
  sm: "max-w-[280px]",
  md: "max-w-[400px]",
  lg: "max-w-[560px]",
  full: "max-w-[calc(100vw-48px)] max-h-[calc(100vh-48px)]",
};

export function Modal({
  open,
  onClose,
  title,
  icon,
  showCloseButton = false,
  size = "md",
  className,
  children,
  ...props
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Handle escape key
  useEffect(() => {
    if (!open) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  // Trap focus within modal
  useEffect(() => {
    if (!open || !dialogRef.current) return;

    const focusableElements = dialogRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    firstElement?.focus();

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener("keydown", handleTab);
    return () => document.removeEventListener("keydown", handleTab);
  }, [open]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className={cn(
        // Full screen overlay
        "fixed inset-0 z-50",
        // Flexbox centering
        "flex items-center justify-center",
        // Padding for mobile
        "p-6"
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
    >
      {/* Scrim (backdrop) */}
      <div
        className={cn(
          "absolute inset-0",
          // M3 scrim: 32% opacity
          "bg-scrim",
          // Animation
          "animate-m3-fade-in"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog container */}
      <div
        ref={dialogRef}
        className={cn(
          // Positioning
          "relative z-10",
          // Size
          "w-full",
          sizeClasses[size],
          // M3 corner radius: 28dp (extra-large)
          "rounded-[28px]",
          // M3 background
          "bg-surface-container-highest",
          // M3 elevation: Level 3
          "shadow-[0_4px_8px_3px_rgba(0,0,0,0.15),0_1px_3px_rgba(0,0,0,0.3)]",
          // M3 padding: 24dp
          "p-6",
          // Animation
          "animate-m3-scale-in",
          className
        )}
        {...props}
      >
        {/* Close button */}
        {showCloseButton && (
          <button
            onClick={onClose}
            className={cn(
              "absolute top-4 right-4",
              "p-2 rounded-full",
              "text-on-surface-variant",
              "hover:bg-[color-mix(in_srgb,transparent_92%,var(--md-sys-color-on-surface-variant)_8%)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary",
              "transition-colors duration-200"
            )}
            aria-label="Close dialog"
            type="button"
          >
            <X className="h-6 w-6" />
          </button>
        )}

        {/* Icon (optional) */}
        {icon && (
          <div className="flex justify-center mb-4 text-secondary [&>svg]:h-6 [&>svg]:w-6">
            {icon}
          </div>
        )}

        {/* Title */}
        {title && (
          <h2
            id="modal-title"
            className={cn(
              // M3 Headline Small
              "text-headline-small text-on-surface",
              // Centered if icon present, otherwise left-aligned
              icon ? "text-center mb-4" : "mb-4"
            )}
          >
            {title}
          </h2>
        )}

        {/* Content */}
        <div className="text-body-medium text-on-surface-variant">
          {children}
        </div>
      </div>
    </div>
  );
}

// Dialog Actions component for action buttons
export function ModalActions({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        // Right-aligned actions
        "flex items-center justify-end gap-2",
        // Margin top
        "mt-6",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// Dialog Content for scrollable content area
export function ModalContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        // Scrollable if content overflows
        "max-h-[60vh] overflow-y-auto",
        // Negative margin to allow full width
        "-mx-6 px-6",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
