import React from "react";
import { cn } from "@/lib/cn";

/**
 * M3 Text Field Types:
 * - filled: Solid background with bottom indicator line
 * - outlined: Border on all sides
 */
type InputVariant = "filled" | "outlined";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: InputVariant;
  /** Label text that floats above the input */
  label?: string;
  /** Helper text displayed below the input */
  helperText?: string;
  /** Error state and message */
  error?: boolean;
  errorText?: string;
  /** Leading icon */
  startIcon?: React.ReactNode;
  /** Trailing icon */
  endIcon?: React.ReactNode;
  /** Full width input */
  fullWidth?: boolean;
}

/**
 * M3 Text Field Specifications:
 * - Height: 56dp
 * - Corner radius: 4dp (top only for filled, all for outlined)
 * - Horizontal padding: 16dp
 * - Label: Body Small when floating, Body Large when resting
 * - Input text: Body Large
 * - Indicator line (filled): 1dp inactive, 2dp active
 * - Border (outlined): 1dp inactive, 2dp active
 */

export function Input({
  className,
  variant = "filled",
  label,
  helperText,
  error = false,
  errorText,
  startIcon,
  endIcon,
  fullWidth = false,
  id,
  disabled,
  ...props
}: InputProps) {
  const generatedId = React.useId();
  const inputId = id || `input-${generatedId}`;
  const hasValue = props.value !== undefined && props.value !== "";
  const [isFocused, setIsFocused] = React.useState(false);

  const showFloatingLabel = label && (isFocused || hasValue || props.placeholder);

  const filledStyles = cn(
    // Container
    "bg-surface-container-highest",
    "rounded-t-[4px] rounded-b-none",
    // Bottom indicator line
    "border-b border-on-surface-variant",
    // Hover state
    "hover:bg-[color-mix(in_srgb,var(--md-sys-color-surface-container-highest)_92%,var(--md-sys-color-on-surface)_8%)]",
    // Focus state - thicker indicator
    isFocused && "border-b-2 border-primary",
    // Error state
    error && "border-b-2 border-error",
    error && isFocused && "border-error"
  );

  const outlinedStyles = cn(
    // Container
    "bg-transparent",
    "rounded-[4px]",
    // Border
    "border border-outline",
    // Hover state
    "hover:border-on-surface",
    // Focus state - thicker border
    isFocused && "border-2 border-primary",
    // Error state
    error && "border-2 border-error",
    error && isFocused && "border-error"
  );

  return (
    <div className={cn("relative", fullWidth && "w-full")}>
      <div
        className={cn(
          // Base container styles
          "relative flex items-center",
          // M3 height
          "h-14",
          // Transition
          "transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)]",
          // Disabled state
          disabled && "opacity-[0.38] pointer-events-none",
          // Variant styles
          variant === "filled" ? filledStyles : outlinedStyles,
          className
        )}
      >
        {/* Leading icon */}
        {startIcon && (
          <span className="flex items-center justify-center pl-3 text-on-surface-variant [&>svg]:h-6 [&>svg]:w-6">
            {startIcon}
          </span>
        )}

        {/* Input container */}
        <div className="relative flex-1 h-full">
          {/* Floating label */}
          {label && (
            <label
              htmlFor={inputId}
              className={cn(
                "absolute left-4 transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)] pointer-events-none",
                // Adjust for start icon
                startIcon ? "left-0" : undefined,
                // Label positioning and styling based on state
                showFloatingLabel
                  ? cn(
                      // Floating state - Body Small
                      "top-2 text-body-small",
                      isFocused ? "text-primary" : "text-on-surface-variant",
                      error && "text-error"
                    )
                  : cn(
                      // Resting state - Body Large, centered
                      "top-1/2 -translate-y-1/2 text-body-large text-on-surface-variant"
                    )
              )}
            >
              {label}
            </label>
          )}

          {/* Input element */}
          <input
            id={inputId}
            disabled={disabled}
            className={cn(
              // Reset and base styles
              "w-full h-full bg-transparent",
              // Padding
              "px-4",
              label ? "pt-5 pb-2" : "py-4",
              startIcon ? "pl-3" : undefined,
              endIcon ? "pr-3" : undefined,
              // Typography - Body Large
              "text-body-large text-on-surface",
              // Placeholder
              "placeholder:text-on-surface-variant",
              // Remove default focus outline
              "focus:outline-none",
              // Caret color
              error ? "caret-error" : "caret-primary"
            )}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur?.(e);
            }}
            {...props}
          />
        </div>

        {/* Trailing icon */}
        {endIcon && (
          <span
            className={cn(
              "flex items-center justify-center pr-3 [&>svg]:h-6 [&>svg]:w-6",
              error ? "text-error" : "text-on-surface-variant"
            )}
          >
            {endIcon}
          </span>
        )}
      </div>

      {/* Helper/Error text */}
      {(helperText || errorText) && (
        <p
          className={cn(
            "mt-1 px-4 text-body-small",
            error && errorText ? "text-error" : "text-on-surface-variant"
          )}
        >
          {error && errorText ? errorText : helperText}
        </p>
      )}
    </div>
  );
}

// Simple input variant for cases where we just need a basic input
export function SimpleInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        // M3 outlined field styling
        "w-full h-14 px-4",
        "rounded-[4px] border border-outline",
        "bg-transparent text-body-large text-on-surface",
        "placeholder:text-on-surface-variant",
        // Hover state
        "hover:border-on-surface",
        // Focus state
        "focus:outline-none focus:border-2 focus:border-primary",
        // Disabled state
        "disabled:opacity-[0.38] disabled:pointer-events-none",
        // Transition
        "transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)]",
        className
      )}
      {...props}
    />
  );
}
