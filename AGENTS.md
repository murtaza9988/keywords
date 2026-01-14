# Development Best Practices & Guidelines

> **This file is the single source of truth for development standards in this repository.**
> All contributors, human or AI, must adhere to these guidelines.

---

## 1. Core Philosophy & Architecture

### Backend: The Service Pattern
- **Routers (`app/routes`)**: strictly for HTTP transport (parsing params, validating input, returning responses). **No business logic here.**
- **Services (`app/services`)**: contain the business logic. They receive Pydantic schemas or primitives, perform operations (often using Repositories or Models), and return results.
- **Models (`app/models`)**: Database table definitions (SQLAlchemy).
- **Schemas (`app/schemas`)**: Data transfer objects (Pydantic). Use these for input validation and output serialization.

### Frontend: Modern React & State
- **Server Components**: Default to Server Components for fetching data. Use Client Components (`"use client"`) only for interactivity (hooks, event listeners).
- **Redux Toolkit**: Used for global client state (e.g., project data, UI preferences).
  - Use `createSlice`.
  - Do not put non-serializable data (functions, class instances) in Redux.
- **Tailwind CSS 4**: The exclusive source of styling.
  - Avoid inline styles (`style={{...}}`).
  - Use utility classes over custom CSS files.
  - Follow the **Design Guidelines** (`frontend/src/app/design-guidelines/page.tsx`) for colors/typography.

---

## 2. Workflow & Hygiene

### Git & Commits
- **Branch Naming**: `feat/short-description`, `fix/issue-description`, `docs/update-readme`.
- **Commit Messages**: Conventional Commits style.
  - `feat: add keyword grouping`
  - `fix: resolve jwt expiration bug`
  - `chore: update dependencies`

### Pre-Commit Checklist
Before submitting a PR, ensure:
1. **Linting**:
   - Frontend: `npm run lint` (ESLint)
   - Backend: `ruff check .` & `black --check .`
2. **Types**:
   - Frontend: `npm run typecheck` (TypeScript)
   - Backend: `mypy .`
3. **Tests**:
   - Frontend: `npm test` (Jest)
   - Backend: `pytest`

---

## 3. Frontend Guidelines (Next.js 15 + React 19)

### Component Structure
- **Co-location**: Keep related files together.
  ```
  components/
  ├── UserProfile/
  │   ├── UserProfile.tsx
  │   ├── UserProfile.test.tsx
  │   └── types.ts
  ```
- **Props**: Use `interface` for props, not `type`. Define them explicitly (avoid `any`).
  - **Guardrail**: Avoid duplicate JSX props. Run `eslint-plugin-react` checks to catch this.

### Performance
- **Virtualization**: Use `react-virtuoso` for any list > 50 items (e.g., Keyword Table).
- **Images**: Always use `next/image` with defined `width`/`height` to prevent layout shift.

### State Management
- **Local State**: Use `useState` for simple component-local UI state (e.g., isModalOpen).
- **Global State**: Use Redux for data shared across pages.
- **Server State**: Prefer fetching fresh data in Server Components or using `SWR`/`React Query` if client-side polling is needed.

### Testing
- **Jest + React Testing Library**:
  - Test *behavior*, not implementation details.
  - Example: `fireEvent.click(screen.getByText('Submit'))` instead of checking internal state.
- **Snapshot Testing**: Use sparingly. They are brittle. Prefer explicit assertions.

---

## 4. Backend Guidelines (FastAPI + Async SQLAlchemy)

### Database & Migrations
- **Async Only**: Use `async`/`await` for all DB operations (`aiosqlite`, `asyncpg`, `aiomysql`).
- **PostgreSQL Priority**: The codebase uses `JSONB` operators. **PostgreSQL is the required production DB**.
  - *Note*: `aiosqlite` is acceptable for local dev IF `JSONB` features are not strictly required or if SQLite JSON1 extension is enabled/compatible.
- **Migrations (Alembic)**:
  - Never modify `models/*.py` without generating a migration: `alembic revision --autogenerate -m "message"`.
  - Inspect the generated migration file before applying.

### Error Handling
- Use `HTTPException` for expected errors (404, 400).
- Let unexpected exceptions bubble up to the global exception handler (500).

### Security
- **Authentication**: Use `Depends(get_current_user)` on all protected routes.
- **Secrets**: NEVER commit secrets. Use `.env` and `pydantic-settings`.
- **SQL Injection**: Always use the ORM or bound parameters. Never string concatenation.

### Testing
- **Pytest**:
  - Use `conftest.py` for fixtures (DB session, auth tokens).
  - Test coverage should include happy paths AND error cases.

---

## 5. Anti-Patterns & Known Risks

> ⚠️ **Avoid these common mistakes identified in this repository.**

1. **Hardcoded Credentials**:
   - *Bad*: `if username == "admin" and password == "secret":`
   - *Good*: Use a proper auth service backed by the DB.

2. **Database Engine Mismatch**:
   - The code uses Postgres-specific features (JSONB `?`, `@>`).
   - *Risk*: Running this on standard MySQL or SQLite without specific extensions will cause runtime 500 errors.
   - *Fix*: Ensure your local env matches production (Postgres) or strictly test your query compatibility.

3. **Prop Drilling**:
   - *Bad*: Passing `user` through 5 layers of components.
   - *Good*: Use Context or Redux.

4. **Duplicate JSX Props**:
   - *Bad*: `<Input value={val} onChange={change} value={val2} />`
   - *Why*: This causes subtle bugs and build warnings. Linting is configured to catch this, do not ignore it.

5. **Ignoring Types**:
   - *Bad*: `const data: any = response;`
   - *Good*: Define the shape. `const data: UserResponse = response;`

---

## 6. Troubleshooting & Maintenance

### "Invalid Project Directory" in Next Lint
If `next lint` fails in CI, ensure it's running from the `frontend` workspace or that the ESLint config points to the correct root.

### Token Backfill
When changing tokenizer logic, you must run the backfill script:
```bash
cd backend
python -m app.scripts.backfill_compounds --project-id <id>
```

### Build & CI Hygiene
- Treat TypeScript errors and Lint warnings as **Blockers**.
- Do not merge if `npm run typecheck` fails.
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
- 2026-01-15: "No children found or failed to load" appeared under every parent keyword because Pydantic schemas were missing `serialize_by_alias=True`. The backend returned snake_case keys (is_parent, group_id) instead of camelCase (isParent, groupId) that the frontend expected. Prevention: Always add `serialize_by_alias=True` to Pydantic model_config when using Field aliases, especially for response models.
- 2026-01-15: Multi-CSV upload showed validation error "X file(s) did not finish processing" even when uploads succeeded. Cause: Empty CSV files and failed CSV files were not being marked as processed, causing uploaded_count > processed_count. Prevention: Always call mark_file_processed (or pass file_name to mark_error/mark_complete) so upload/processed counts match.
- 2026-01-15: Vercel lint failed due to an unused `onUploadBatchStart` prop in `ProjectDetailOverview` and missing hook dependencies in `ProjectDetail.tsx`. Prevention: verify all declared props are passed through to their consumers, and resolve `react-hooks/exhaustive-deps` warnings before commit by checking dependency arrays against referenced variables.
- 2026-01-14: Vercel build failed due to duplicate React state declaration (`activeTab`) in `ProjectDetail.tsx`, triggering a client component SSR error. Prevention: enable `react/jsx-no-duplicate-props` lint rule, review for duplicate declarations/props during edits, and keep lint/typecheck required before commits.
- 2026-01-14: Multi-CSV uploads failed because the backend rejected new uploads while processing and the UI surfaced only a generic error. Prevention: queue uploads per project, expose queue metadata in processing status, and show step-by-step progress with detailed error messages.
- 2026-01-14: Vercel build failed due to an incomplete duplicate `const transformedKeywords` block in `ProjectDetail.tsx`, causing a syntax error in `next build`. Prevention: remove duplicate declarations, verify block structure, and keep lint/typecheck running before builds.
