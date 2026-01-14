# Development Best Practices

## Build and CI hygiene
- Run `npm run lint` and `npm run typecheck` at the workspace root before committing changes.
- If `next lint` fails with an invalid project directory error, fix the lint configuration or run lint directly from the `frontend` workspace to keep CI green.
- Treat TypeScript and ESLint errors as build blockers; resolve them before merging.

## React/Next.js guardrails
- Avoid duplicate JSX props. Duplicates can be introduced via copy/paste or merge conflicts and will fail builds (e.g., `JSX elements cannot have multiple attributes with the same name`).
- Prefer passing grouped props as objects when lists get long to reduce copy/paste mistakes.
- Enable ESLint rule `react/jsx-no-duplicate-props` in the frontend lint config to catch duplicates early.
- Verify component prop interfaces and usage match exactly after refactors.

## Code review discipline
- Scan large JSX blocks for repeated attributes or repeated entries in prop interfaces.
- Resolve merge conflicts carefully in prop lists; repeated keys are a common symptom of a bad merge.
- Use `rg -n "<propName>"` to confirm props appear exactly once in interfaces and call sites.

## Documentation and maintenance
- Keep this file updated with new failure modes observed in CI/Vercel.
- When a production incident is fixed, document the root cause and prevention steps here.

## Incident log
- 2026-01-14: Vercel build failed due to duplicate React state declaration (`activeTab`) in `ProjectDetail.tsx`, triggering a client component SSR error. Prevention: enable `react/jsx-no-duplicate-props` lint rule, review for duplicate declarations/props during edits, and keep lint/typecheck required before commits.
- 2026-01-14: Multi-CSV uploads failed because the backend rejected new uploads while processing and the UI surfaced only a generic error. Prevention: queue uploads per project, expose queue metadata in processing status, and show step-by-step progress with detailed error messages.
