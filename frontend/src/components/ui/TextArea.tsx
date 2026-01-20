import React from "react";
import { cn } from "@/lib/cn";

/**
 * M3 Text Field Types:
 * - filled: Solid background with bottom indicator line
 * - outlined: Border on all sides
 */
type TextAreaVariant = "filled" | "outlined";

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  variant?: TextAreaVariant;
  /** Label text that floats above the textarea */
  label?: string;
  /** Helper text displayed below the textarea */
  helperText?: string;
  /** Error state and message */
  error?: boolean;
  errorText?: string;
  /** Full width textarea */
  fullWidth?: boolean;
}

/**
 * M3 Text Field Specifications (applied to textarea):
 * - Min height: 56dp (expandable)
 * - Corner radius: 4dp (top only for filled, all for outlined)
 * - Horizontal padding: 16dp
 * - Label: Body Small when floating, Body Large when resting
 * - Input text: Body Large
 * - Indicator line (filled): 1dp inactive, 2dp active
 * - Border (outlined): 1dp inactive, 2dp active
 */

export function TextArea({
  className,
  variant = "filled",
  label,
  helperText,
  error = false,
  errorText,
  fullWidth = false,
  id,
  disabled,
  ...props
}: TextAreaProps) {
  const textareaId = id || `textarea-${React.useId()}`;
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
          "relative flex flex-col",
          // Min height
          "min-h-[112px]",
          // Transition
          "transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)]",
          // Disabled state
          disabled && "opacity-[0.38] pointer-events-none",
          // Variant styles
          variant === "filled" ? filledStyles : outlinedStyles,
          className
        )}
      >
        {/* Floating label */}
        {label && (
          <label
            htmlFor={textareaId}
            className={cn(
              "absolute left-4 transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)] pointer-events-none",
              // Label positioning and styling based on state
              showFloatingLabel
                ? cn(
                    // Floating state - Body Small
                    "top-2 text-body-small",
                    isFocused ? "text-primary" : "text-on-surface-variant",
                    error && "text-error"
                  )
                : cn(
                    // Resting state - Body Large
                    "top-4 text-body-large text-on-surface-variant"
                  )
            )}
          >
            {label}
          </label>
        )}

        {/* Textarea element */}
        <textarea
          id={textareaId}
          disabled={disabled}
          className={cn(
            // Reset and base styles
            "w-full flex-1 bg-transparent resize-y",
            // Padding
            "px-4",
            label ? "pt-6 pb-2" : "py-4",
            // Typography - Body Large
            "text-body-large text-on-surface",
            // Placeholder
            "placeholder:text-on-surface-variant",
            // Remove default focus outline
            "focus:outline-none",
            // Caret color
            error ? "caret-error" : "caret-primary",
            // Min height for textarea content
            "min-h-[80px]"
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

// Simple textarea variant for cases where we just need a basic textarea
export function SimpleTextArea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        // M3 outlined field styling
        "w-full min-h-[112px] px-4 py-4",
        "rounded-[4px] border border-outline",
        "bg-transparent text-body-large text-on-surface",
        "placeholder:text-on-surface-variant",
        // Resize
        "resize-y",
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
