import React from "react";
import { cn } from "@/lib/cn";

/**
 * M3 Card Types:
 * - elevated: Surface color with shadow (Level 1)
 * - filled: Surface container highest, no shadow
 * - outlined: Surface with outline border
 */
type CardVariant = "elevated" | "filled" | "outlined";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  /** Whether the card is interactive (clickable) */
  interactive?: boolean;
}

/**
 * M3 Card Specifications:
 * - Corner radius: 12dp
 * - Internal padding: 16dp
 * - Elevation: Level 1 (1dp) for elevated variant
 */

const variantClasses: Record<CardVariant, string> = {
  elevated: cn(
    "bg-surface-container-low",
    // Level 1 elevation
    "shadow-[0_1px_2px_rgba(0,0,0,0.3),0_1px_3px_1px_rgba(0,0,0,0.15)]"
  ),
  filled: cn(
    "bg-surface-container-highest"
  ),
  outlined: cn(
    "bg-surface",
    "border border-outline-variant"
  ),
};

const interactiveClasses: Record<CardVariant, string> = {
  elevated: cn(
    "cursor-pointer",
    // Hover: elevation +1 (Level 2) + state layer
    "hover:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_2px_6px_2px_rgba(0,0,0,0.15)]",
    "hover:bg-[color-mix(in_srgb,var(--md-sys-color-surface-container-low)_92%,var(--md-sys-color-on-surface)_8%)]",
    // Focus
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
    // Pressed
    "active:bg-[color-mix(in_srgb,var(--md-sys-color-surface-container-low)_88%,var(--md-sys-color-on-surface)_12%)]"
  ),
  filled: cn(
    "cursor-pointer",
    // Hover: state layer
    "hover:bg-[color-mix(in_srgb,var(--md-sys-color-surface-container-highest)_92%,var(--md-sys-color-on-surface)_8%)]",
    // Focus
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
    // Pressed
    "active:bg-[color-mix(in_srgb,var(--md-sys-color-surface-container-highest)_88%,var(--md-sys-color-on-surface)_12%)]"
  ),
  outlined: cn(
    "cursor-pointer",
    // Hover: state layer
    "hover:bg-[color-mix(in_srgb,var(--md-sys-color-surface)_92%,var(--md-sys-color-on-surface)_8%)]",
    // Focus
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
    // Pressed
    "active:bg-[color-mix(in_srgb,var(--md-sys-color-surface)_88%,var(--md-sys-color-on-surface)_12%)]"
  ),
};

export function Card({
  className,
  variant = "elevated",
  interactive = false,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        // M3 corner radius: 12dp
        "rounded-xl",
        // Transition
        "transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)]",
        // Variant styles
        variantClasses[variant],
        // Interactive styles
        interactive && interactiveClasses[variant],
        className
      )}
      tabIndex={interactive ? 0 : undefined}
      role={interactive ? "button" : undefined}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        // M3 card internal padding
        "flex flex-col gap-1 p-4 pb-0",
        className
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        // M3 Title Large
        "text-title-large text-on-surface",
        className
      )}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        // M3 Body Medium
        "text-body-medium text-on-surface-variant",
        className
      )}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        // M3 card internal padding
        "p-4",
        className
      )}
      {...props}
    />
  );
}

export function CardActions({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        // Actions aligned to the right
        "flex items-center justify-end gap-2 p-4 pt-0",
        className
      )}
      {...props}
    />
  );
}

export function CardMedia({
  className,
  src,
  alt,
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement>) {
  return (
    <img
      src={src}
      alt={alt}
      className={cn(
        // Full width, maintain aspect ratio
        "w-full object-cover",
        // Rounded top corners if first element
        "first:rounded-t-xl",
        className
      )}
      {...props}
    />
  );
}
