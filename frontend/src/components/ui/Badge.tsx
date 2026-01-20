import React from "react";
import { cn } from "@/lib/cn";

/**
 * M3 Badge Types:
 * - Small: Status indicator only (6dp dot)
 * - Large: With count or label (16dp height)
 *
 * M3 Badge Specifications:
 * - Small: 6dp size, full radius
 * - Large: 16dp height, min 16dp width, full radius, 4dp horizontal padding
 * - Text style: Label Small
 * - Default color: Error
 */

type BadgeVariant = "default" | "primary" | "secondary" | "success" | "warning" | "error";
type BadgeSize = "small" | "large";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  /** Count to display (only for large size) */
  count?: number;
  /** Maximum count to display before showing + */
  maxCount?: number;
  /** Show a dot instead of content */
  dot?: boolean;
}

const variantClasses: Record<BadgeVariant, { container: string; text: string }> = {
  default: {
    container: "bg-surface-container-highest",
    text: "text-on-surface",
  },
  primary: {
    container: "bg-primary",
    text: "text-on-primary",
  },
  secondary: {
    container: "bg-secondary-container",
    text: "text-on-secondary-container",
  },
  success: {
    container: "bg-success-container",
    text: "text-on-success-container",
  },
  warning: {
    container: "bg-warning-container",
    text: "text-on-warning-container",
  },
  error: {
    container: "bg-error",
    text: "text-on-error",
  },
};

export function Badge({
  className,
  variant = "error",
  size = "large",
  count,
  maxCount = 999,
  dot = false,
  children,
  ...props
}: BadgeProps) {
  const variantStyles = variantClasses[variant];
  const displayCount = count !== undefined && count > maxCount ? `${maxCount}+` : count;
  const isSmall = size === "small" || dot;

  return (
    <span
      className={cn(
        // Base styles
        "inline-flex items-center justify-center",
        // M3 full radius (pill shape)
        "rounded-full",
        // Container color
        variantStyles.container,
        // Size-specific styles
        isSmall
          ? // Small badge (6dp dot)
            "h-1.5 w-1.5 min-w-1.5"
          : // Large badge (16dp height)
            cn(
              "h-4 min-w-4 px-1",
              // M3 Label Small typography
              "text-label-small font-medium",
              variantStyles.text
            ),
        className
      )}
      {...props}
    >
      {!isSmall && (displayCount ?? children)}
    </span>
  );
}

// Badge wrapper for positioning badges on other elements
interface BadgeWrapperProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Badge content or props */
  badge: React.ReactNode;
  /** Position of the badge */
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  /** Whether the badge should overlap the content */
  overlap?: "rectangular" | "circular";
}

const positionClasses = {
  "top-right": "-top-1 -right-1",
  "top-left": "-top-1 -left-1",
  "bottom-right": "-bottom-1 -right-1",
  "bottom-left": "-bottom-1 -left-1",
};

const overlapClasses = {
  rectangular: "",
  circular: "translate-x-1/4 -translate-y-1/4",
};

export function BadgeWrapper({
  className,
  badge,
  position = "top-right",
  overlap = "rectangular",
  children,
  ...props
}: BadgeWrapperProps) {
  return (
    <div className={cn("relative inline-flex", className)} {...props}>
      {children}
      <span
        className={cn(
          "absolute",
          positionClasses[position],
          overlapClasses[overlap]
        )}
      >
        {badge}
      </span>
    </div>
  );
}

// Chip component (related to badges in M3)
type ChipVariant = "assist" | "filter" | "input" | "suggestion";

interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ChipVariant;
  /** Whether the chip is selected (for filter chips) */
  selected?: boolean;
  /** Leading icon */
  icon?: React.ReactNode;
  /** Whether to show remove button (for input chips) */
  onRemove?: () => void;
}

/**
 * M3 Chip Specifications:
 * - Height: 32dp
 * - Corner radius: 8dp
 * - Horizontal padding: 16dp (text only), 8dp (with icon)
 * - Icon size: 18dp
 * - Text style: Label Large
 */

export function Chip({
  className,
  variant = "assist",
  selected = false,
  icon,
  onRemove,
  disabled = false,
  children,
  onClick,
  ...props
}: ChipProps) {
  const isInput = variant === "input";
  const isFilter = variant === "filter";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        // Base styles
        "inline-flex items-center justify-center gap-2",
        // M3 height: 32dp
        "h-8",
        // M3 corner radius: 8dp
        "rounded-lg",
        // M3 padding
        icon ? "pl-2 pr-4" : "px-4",
        isInput && onRemove && "pr-2",
        // M3 Label Large typography
        "text-label-large font-medium",
        // Border for non-selected state
        !selected && "border border-outline",
        // Background and text colors based on state
        selected
          ? "bg-secondary-container text-on-secondary-container border-transparent"
          : "bg-transparent text-on-surface",
        // Hover state
        !disabled && !selected && "hover:bg-[color-mix(in_srgb,transparent_92%,var(--md-sys-color-on-surface)_8%)]",
        !disabled && selected && "hover:bg-[color-mix(in_srgb,var(--md-sys-color-secondary-container)_92%,var(--md-sys-color-on-secondary-container)_8%)]",
        // Focus state
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        // Disabled state
        disabled && "opacity-[0.38] pointer-events-none",
        // Transition
        "transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)]",
        className
      )}
      {...props}
    >
      {/* Leading icon or checkmark for filter chips */}
      {isFilter && selected ? (
        <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : icon ? (
        <span className="[&>svg]:h-[18px] [&>svg]:w-[18px]">{icon}</span>
      ) : null}

      {/* Label */}
      <span>{children}</span>

      {/* Remove button for input chips */}
      {isInput && onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className={cn(
            "p-0.5 rounded-full",
            "hover:bg-[color-mix(in_srgb,transparent_88%,var(--md-sys-color-on-surface)_12%)]",
            "focus-visible:outline-none"
          )}
          aria-label="Remove"
        >
          <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </button>
  );
}
