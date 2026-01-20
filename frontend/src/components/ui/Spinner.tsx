import React from "react";
import { cn } from "@/lib/cn";

/**
 * M3 Progress Indicator Specifications:
 *
 * Circular Progress:
 * - Small: 24dp
 * - Medium: 40dp
 * - Large: 48dp
 * - Stroke width: 4dp
 * - Track color: Surface Container Highest
 * - Indicator color: Primary
 *
 * Linear Progress:
 * - Height: 4dp
 * - Corner radius: 2dp
 */

interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg";
  /** Color variant */
  variant?: "primary" | "secondary" | "tertiary";
}

const sizeClasses = {
  sm: "h-6 w-6",
  md: "h-10 w-10",
  lg: "h-12 w-12",
};

const strokeWidthClasses = {
  sm: "border-[3px]",
  md: "border-4",
  lg: "border-4",
};

const variantClasses = {
  primary: "border-primary border-t-transparent",
  secondary: "border-secondary border-t-transparent",
  tertiary: "border-tertiary border-t-transparent",
};

export function Spinner({
  size = "md",
  variant = "primary",
  className,
  ...props
}: SpinnerProps) {
  return (
    <div
      role="progressbar"
      aria-label="Loading"
      className={cn(
        // Animation
        "animate-spin",
        // Shape
        "rounded-full",
        // Size
        sizeClasses[size],
        // Stroke
        strokeWidthClasses[size],
        // Colors - M3 uses track color (surface) with indicator (primary)
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}

// Linear Progress Indicator
interface LinearProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Progress value (0-100). If undefined, shows indeterminate state */
  value?: number;
  /** Color variant */
  variant?: "primary" | "secondary" | "tertiary";
}

const linearVariantClasses = {
  primary: "bg-primary",
  secondary: "bg-secondary",
  tertiary: "bg-tertiary",
};

export function LinearProgress({
  value,
  variant = "primary",
  className,
  ...props
}: LinearProgressProps) {
  const isIndeterminate = value === undefined;

  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        // M3 linear progress height: 4dp
        "h-1 w-full overflow-hidden",
        // M3 corner radius: 2dp
        "rounded-full",
        // Track color
        "bg-surface-container-highest",
        className
      )}
      {...props}
    >
      <div
        className={cn(
          // Indicator
          "h-full rounded-full",
          // Color
          linearVariantClasses[variant],
          // Animation for indeterminate
          isIndeterminate && "animate-[indeterminate_1.5s_ease-in-out_infinite]",
          // Transition for determinate
          !isIndeterminate && "transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)]"
        )}
        style={{
          width: isIndeterminate ? "30%" : `${value}%`,
          ...(isIndeterminate && {
            animation: "linear-progress-indeterminate 1.5s ease-in-out infinite",
          }),
        }}
      />
      <style jsx>{`
        @keyframes linear-progress-indeterminate {
          0% {
            transform: translateX(-100%);
          }
          50% {
            transform: translateX(200%);
          }
          100% {
            transform: translateX(-100%);
          }
        }
      `}</style>
    </div>
  );
}

// Circular Progress with determinate value
interface CircularProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Progress value (0-100). If undefined, shows indeterminate spinner */
  value?: number;
  /** Size in pixels */
  size?: number;
  /** Stroke width in pixels */
  strokeWidth?: number;
  /** Color variant */
  variant?: "primary" | "secondary" | "tertiary";
}

export function CircularProgress({
  value,
  size = 40,
  strokeWidth = 4,
  variant = "primary",
  className,
  ...props
}: CircularProgressProps) {
  const isIndeterminate = value === undefined;

  if (isIndeterminate) {
    return <Spinner size="md" variant={variant} className={className} {...props} />;
  }

  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  const variantColors = {
    primary: "var(--md-sys-color-primary)",
    secondary: "var(--md-sys-color-secondary)",
    tertiary: "var(--md-sys-color-tertiary)",
  };

  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("relative", className)}
      style={{ width: size, height: size }}
      {...props}
    >
      <svg
        className="rotate-[-90deg]"
        width={size}
        height={size}
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--md-sys-color-surface-container-highest)"
          strokeWidth={strokeWidth}
        />
        {/* Indicator */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={variantColors[variant]}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)]"
        />
      </svg>
    </div>
  );
}
