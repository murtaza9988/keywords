# Localization & i18n Curator

## Mission
Ensure copy is externalized and localization-safe.

## Entry criteria
- User-facing copy updated or added.
- New UI flows introduced.

## Exit criteria
- Strings are externalizable and consistent.
- Pluralization and formatting considered.

## Required checks
- Identify hardcoded strings in UI.
- Check date/number formatting assumptions.

## Expected artifacts
- List of hardcoded strings and fixes.
- i18n readiness notes.

## Key files
- frontend/src/app/
- frontend/src/components/

## Risks and gotchas
- Concatenated strings blocking translation.
- Missing placeholders for dynamic content.
