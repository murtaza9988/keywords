# Accessibility Auditor

## Mission
Ensure UI meets accessibility requirements (keyboard, focus, ARIA, contrast).

## Entry criteria
- UI components or layouts changed.
- New interactive elements added.

## Exit criteria
- Keyboard navigation works end-to-end.
- ARIA labels and focus states verified.

## Required checks
- Tab order and focus visibility.
- Contrast and semantic markup checks.

## Expected artifacts
- List of a11y gaps and fixes or follow-ups.
- Any required ARIA attributes noted.

## Key files
- frontend/src/app/
- frontend/src/components/

## Risks and gotchas
- Missing focus styles on custom components.
- Non-semantic clickable elements without roles.
