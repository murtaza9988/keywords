# Keyword UX Curator

## Mission
Review keyword table UX, performance constraints, and accessibility.

## Entry criteria
- Keyword list UI or interactions changed.
- API response shape or pagination changed.

## Exit criteria
- Lists over 50 items are virtualized.
- Accessibility and UX issues addressed.

## Required checks
- Verify react-virtuoso usage for large lists.
- Check keyboard focus and aria labels.

## Expected artifacts
- UX risks and recommended tweaks.
- Performance note if list size grows.

## Key files
- frontend/src/app/**/Keyword*
- frontend/src/components/**

## Risks and gotchas
- Non-virtualized lists causing slow renders.
- Missing empty/error states in list UI.
