import React from "react";
import { cn } from "@/lib/cn";

/**
 * M3 Button Variants:
 * - filled: Primary actions (highest emphasis)
 * - tonal: Secondary actions (filled tonal)
 * - elevated: Medium emphasis with shadow
 * - outlined: Secondary actions with border
 * - text: Lowest emphasis, text only
 * - danger: Error/destructive actions
 */
type ButtonVariant = "filled" | "tonal" | "elevated" | "outlined" | "text" | "danger" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Optional icon to display before the label */
  startIcon?: React.ReactNode;
  /** Optional icon to display after the label */
  endIcon?: React.ReactNode;
}

/**
 * M3 Button Specifications:
 * - Height: 40dp
 * - Corner radius: Full (pill-shaped)
 * - Horizontal padding: 24dp (text only), 16dp (with icon)
 * - Icon size: 18dp
 * - Icon-to-label gap: 8dp
 * - Text style: Label Large
 */
const variantClasses: Record<ButtonVariant, string> = {
  // Filled button: Primary container color
  filled: cn(
    "bg-primary text-on-primary",
    "hover:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_1px_3px_1px_rgba(0,0,0,0.15)]",
    "hover:bg-[color-mix(in_srgb,var(--md-sys-color-primary)_92%,var(--md-sys-color-on-primary)_8%)]",
    "focus-visible:bg-[color-mix(in_srgb,var(--md-sys-color-primary)_90%,var(--md-sys-color-on-primary)_10%)]",
    "active:bg-[color-mix(in_srgb,var(--md-sys-color-primary)_88%,var(--md-sys-color-on-primary)_12%)]",
    "active:shadow-none"
  ),
  // Filled tonal button: Secondary container color
  tonal: cn(
    "bg-secondary-container text-on-secondary-container",
    "hover:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_1px_3px_1px_rgba(0,0,0,0.15)]",
    "hover:bg-[color-mix(in_srgb,var(--md-sys-color-secondary-container)_92%,var(--md-sys-color-on-secondary-container)_8%)]",
    "focus-visible:bg-[color-mix(in_srgb,var(--md-sys-color-secondary-container)_90%,var(--md-sys-color-on-secondary-container)_10%)]",
    "active:bg-[color-mix(in_srgb,var(--md-sys-color-secondary-container)_88%,var(--md-sys-color-on-secondary-container)_12%)]",
    "active:shadow-none"
  ),
  // Elevated button: Surface with shadow
  elevated: cn(
    "bg-surface-container-low text-primary shadow-[0_1px_2px_rgba(0,0,0,0.3),0_1px_3px_1px_rgba(0,0,0,0.15)]",
    "hover:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_2px_6px_2px_rgba(0,0,0,0.15)]",
    "hover:bg-[color-mix(in_srgb,var(--md-sys-color-surface-container-low)_92%,var(--md-sys-color-primary)_8%)]",
    "focus-visible:bg-[color-mix(in_srgb,var(--md-sys-color-surface-container-low)_90%,var(--md-sys-color-primary)_10%)]",
    "active:bg-[color-mix(in_srgb,var(--md-sys-color-surface-container-low)_88%,var(--md-sys-color-primary)_12%)]"
  ),
  // Outlined button: Border with transparent background
  outlined: cn(
    "border border-outline bg-transparent text-primary",
    "hover:bg-[color-mix(in_srgb,transparent_92%,var(--md-sys-color-primary)_8%)]",
    "focus-visible:bg-[color-mix(in_srgb,transparent_90%,var(--md-sys-color-primary)_10%)]",
    "active:bg-[color-mix(in_srgb,transparent_88%,var(--md-sys-color-primary)_12%)]"
  ),
  // Text button: No container, just text
  text: cn(
    "bg-transparent text-primary",
    "hover:bg-[color-mix(in_srgb,transparent_92%,var(--md-sys-color-primary)_8%)]",
    "focus-visible:bg-[color-mix(in_srgb,transparent_90%,var(--md-sys-color-primary)_10%)]",
    "active:bg-[color-mix(in_srgb,transparent_88%,var(--md-sys-color-primary)_12%)]"
  ),
  // Danger button: Error color variant
  danger: cn(
    "bg-error text-on-error",
    "hover:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_1px_3px_1px_rgba(0,0,0,0.15)]",
    "hover:bg-[color-mix(in_srgb,var(--md-sys-color-error)_92%,var(--md-sys-color-on-error)_8%)]",
    "focus-visible:bg-[color-mix(in_srgb,var(--md-sys-color-error)_90%,var(--md-sys-color-on-error)_10%)]",
    "active:bg-[color-mix(in_srgb,var(--md-sys-color-error)_88%,var(--md-sys-color-on-error)_12%)]",
    "active:shadow-none"
  ),
  // Secondary button: Alias for outlined (backward compatibility)
  secondary: cn(
    "border border-outline bg-transparent text-primary",
    "hover:bg-[color-mix(in_srgb,transparent_92%,var(--md-sys-color-primary)_8%)]",
    "focus-visible:bg-[color-mix(in_srgb,transparent_90%,var(--md-sys-color-primary)_10%)]",
    "active:bg-[color-mix(in_srgb,transparent_88%,var(--md-sys-color-primary)_12%)]"
  ),
  // Ghost button: Alias for text (backward compatibility)
  ghost: cn(
    "bg-transparent text-primary",
    "hover:bg-[color-mix(in_srgb,transparent_92%,var(--md-sys-color-primary)_8%)]",
    "focus-visible:bg-[color-mix(in_srgb,transparent_90%,var(--md-sys-color-primary)_10%)]",
    "active:bg-[color-mix(in_srgb,transparent_88%,var(--md-sys-color-primary)_12%)]"
  ),
};

/**
 * M3 Button sizes following design specs
 * Standard button height is 40dp
 */
const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 min-w-[64px] px-4 text-label-medium gap-1.5",
  md: "h-10 min-w-[64px] px-6 text-label-large gap-2",
  lg: "h-12 min-w-[80px] px-8 text-label-large gap-2",
};

const iconSizeClasses: Record<ButtonSize, string> = {
  sm: "[&>svg]:h-4 [&>svg]:w-4",
  md: "[&>svg]:h-[18px] [&>svg]:w-[18px]",
  lg: "[&>svg]:h-5 [&>svg]:w-5",
};

export function Button({
  className,
  variant = "filled",
  size = "md",
  type = "button",
  startIcon,
  endIcon,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        // Base styles
        "relative inline-flex items-center justify-center",
        // M3 pill shape
        "rounded-full",
        // Typography - Label Large
        "font-medium",
        // Transitions with M3 motion
        "transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)]",
        // Focus styles (M3 focus ring)
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        // Disabled state (M3: 38% content opacity, 12% container opacity)
        "disabled:pointer-events-none disabled:opacity-[0.38]",
        // Variant styles
        variantClasses[variant],
        // Size styles
        sizeClasses[size],
        // Icon sizing
        iconSizeClasses[size],
        // Adjust padding when icons are present
        startIcon ? "pl-4" : undefined,
        endIcon ? "pr-4" : undefined,
        className
      )}
      {...props}
    >
      {startIcon && <span className="flex-shrink-0">{startIcon}</span>}
      {children}
      {endIcon && <span className="flex-shrink-0">{endIcon}</span>}
    </button>
  );
}

// Legacy variant mapping for backward compatibility
export type { ButtonProps };

// Icon Button component for icon-only buttons
interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "standard" | "filled" | "tonal" | "outlined";
  size?: "sm" | "md" | "lg";
}

const iconButtonVariantClasses: Record<IconButtonProps["variant"] & string, string> = {
  standard: cn(
    "text-on-surface-variant bg-transparent",
    "hover:bg-[color-mix(in_srgb,transparent_92%,var(--md-sys-color-on-surface-variant)_8%)]",
    "focus-visible:bg-[color-mix(in_srgb,transparent_90%,var(--md-sys-color-on-surface-variant)_10%)]",
    "active:bg-[color-mix(in_srgb,transparent_88%,var(--md-sys-color-on-surface-variant)_12%)]"
  ),
  filled: cn(
    "bg-primary text-on-primary",
    "hover:bg-[color-mix(in_srgb,var(--md-sys-color-primary)_92%,var(--md-sys-color-on-primary)_8%)]",
    "focus-visible:bg-[color-mix(in_srgb,var(--md-sys-color-primary)_90%,var(--md-sys-color-on-primary)_10%)]",
    "active:bg-[color-mix(in_srgb,var(--md-sys-color-primary)_88%,var(--md-sys-color-on-primary)_12%)]"
  ),
  tonal: cn(
    "bg-secondary-container text-on-secondary-container",
    "hover:bg-[color-mix(in_srgb,var(--md-sys-color-secondary-container)_92%,var(--md-sys-color-on-secondary-container)_8%)]",
    "focus-visible:bg-[color-mix(in_srgb,var(--md-sys-color-secondary-container)_90%,var(--md-sys-color-on-secondary-container)_10%)]",
    "active:bg-[color-mix(in_srgb,var(--md-sys-color-secondary-container)_88%,var(--md-sys-color-on-secondary-container)_12%)]"
  ),
  outlined: cn(
    "border border-outline text-on-surface-variant bg-transparent",
    "hover:bg-[color-mix(in_srgb,transparent_92%,var(--md-sys-color-on-surface-variant)_8%)]",
    "focus-visible:bg-[color-mix(in_srgb,transparent_90%,var(--md-sys-color-on-surface-variant)_10%)]",
    "active:bg-[color-mix(in_srgb,transparent_88%,var(--md-sys-color-on-surface-variant)_12%)]"
  ),
};

const iconButtonSizeClasses: Record<IconButtonProps["size"] & string, string> = {
  sm: "h-8 w-8 [&>svg]:h-5 [&>svg]:w-5",
  md: "h-10 w-10 [&>svg]:h-6 [&>svg]:w-6",
  lg: "h-12 w-12 [&>svg]:h-6 [&>svg]:w-6",
};

export function IconButton({
  className,
  variant = "standard",
  size = "md",
  type = "button",
  disabled,
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        // Base styles
        "relative inline-flex items-center justify-center",
        // M3 standard icon button is rounded
        "rounded-full",
        // Transitions
        "transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)]",
        // Focus styles
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        // Disabled state
        "disabled:pointer-events-none disabled:opacity-[0.38]",
        // Variant styles
        iconButtonVariantClasses[variant],
        // Size styles
        iconButtonSizeClasses[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// FAB (Floating Action Button) component
interface FABProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "tertiary" | "surface";
  size?: "small" | "medium" | "large";
  extended?: boolean;
  icon: React.ReactNode;
  label?: string;
}

const fabVariantClasses: Record<FABProps["variant"] & string, string> = {
  primary: cn(
    "bg-primary-container text-on-primary-container",
    "hover:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_2px_6px_2px_rgba(0,0,0,0.15)]",
    "hover:bg-[color-mix(in_srgb,var(--md-sys-color-primary-container)_92%,var(--md-sys-color-on-primary-container)_8%)]"
  ),
  secondary: cn(
    "bg-secondary-container text-on-secondary-container",
    "hover:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_2px_6px_2px_rgba(0,0,0,0.15)]",
    "hover:bg-[color-mix(in_srgb,var(--md-sys-color-secondary-container)_92%,var(--md-sys-color-on-secondary-container)_8%)]"
  ),
  tertiary: cn(
    "bg-tertiary-container text-on-tertiary-container",
    "hover:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_2px_6px_2px_rgba(0,0,0,0.15)]",
    "hover:bg-[color-mix(in_srgb,var(--md-sys-color-tertiary-container)_92%,var(--md-sys-color-on-tertiary-container)_8%)]"
  ),
  surface: cn(
    "bg-surface-container-high text-primary",
    "hover:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_2px_6px_2px_rgba(0,0,0,0.15)]",
    "hover:bg-[color-mix(in_srgb,var(--md-sys-color-surface-container-high)_92%,var(--md-sys-color-primary)_8%)]"
  ),
};

const fabSizeClasses: Record<FABProps["size"] & string, { button: string; icon: string }> = {
  small: { button: "h-10 min-w-10 rounded-xl", icon: "[&>svg]:h-6 [&>svg]:w-6" },
  medium: { button: "h-14 min-w-14 rounded-2xl", icon: "[&>svg]:h-6 [&>svg]:w-6" },
  large: { button: "h-24 min-w-24 rounded-[28px]", icon: "[&>svg]:h-9 [&>svg]:w-9" },
};

export function FAB({
  className,
  variant = "primary",
  size = "medium",
  extended = false,
  icon,
  label,
  type = "button",
  disabled,
  ...props
}: FABProps) {
  const sizeStyles = fabSizeClasses[size];

  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        // Base styles
        "relative inline-flex items-center justify-center",
        // Shadow (Level 3)
        "shadow-[0_4px_8px_3px_rgba(0,0,0,0.15),0_1px_3px_rgba(0,0,0,0.3)]",
        // Transitions
        "transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)]",
        // Focus styles
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        // Disabled state
        "disabled:pointer-events-none disabled:opacity-[0.38] disabled:shadow-none",
        // Variant styles
        fabVariantClasses[variant],
        // Size styles (non-extended)
        !extended && sizeStyles.button,
        // Extended FAB styles
        extended && "h-14 px-4 gap-3 rounded-2xl",
        // Icon size
        sizeStyles.icon,
        className
      )}
      {...props}
    >
      {icon}
      {extended && label && (
        <span className="text-label-large font-medium">{label}</span>
      )}
    </button>
  );
}
