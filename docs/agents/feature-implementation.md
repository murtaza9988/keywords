# Feature Implementation

> **Mission:** Deliver scoped features end-to-end with correct data flow, state management, and comprehensive testing.

---

## Required Reading Before Starting

- [CLAUDE.md](../../CLAUDE.md) - Session rules and protocols
- [AGENTS.md](../../AGENTS.md) - Architecture patterns
- [REPO_REVIEW.md](../../REPO_REVIEW.md) - System architecture overview
- [AI_INSTRUCTION_INDEX.md](../AI_INSTRUCTION_INDEX.md) - Section 3
- [BUG_REGISTRY.md](../BUG_REGISTRY.md) - Avoid known issues

---

## Entry Criteria

Before starting feature work, verify:

- [ ] Feature spec or user story provided and understood
- [ ] Acceptance criteria defined and clear
- [ ] Required routes, services, components identified
- [ ] Database schema changes identified (if any)
- [ ] No blocking dependencies on other work
- [ ] Questions asked and clarified BEFORE coding

---

## Exit Criteria

Feature is complete when:

- [ ] Feature works in UI and API paths
- [ ] All acceptance criteria met
- [ ] Backend tests cover service logic
- [ ] Frontend tests cover key interactions
- [ ] Error states handled gracefully
- [ ] Loading states implemented
- [ ] Documentation updated
- [ ] PR created with clear description

---

## Feature Development Protocol

### Phase 1: Requirements Clarification

```markdown
## Requirements Checklist

### User Story
- [ ] Who is the user?
- [ ] What do they want to do?
- [ ] Why do they want to do it?
- [ ] What does success look like?

### Acceptance Criteria
- [ ] All criteria documented
- [ ] Each criterion is testable
- [ ] Edge cases identified
- [ ] Error scenarios defined

### Questions to Ask
- [ ] What happens when [edge case]?
- [ ] What error messages should show?
- [ ] What are the permission requirements?
- [ ] Are there performance requirements?
- [ ] Are there existing patterns to follow?
```

**STOP if requirements are unclear. Ask questions first.**

### Phase 2: Design

```markdown
## Design Document Template

### Overview
Brief description of the feature.

### User Flow
1. User does X
2. System responds with Y
3. User sees Z

### Technical Design

#### Backend
- **New/Modified Routes:**
  - `POST /api/endpoint` - Description
- **New/Modified Services:**
  - `ServiceName.method()` - Description
- **New/Modified Models:**
  - `ModelName` - New fields/changes
- **New/Modified Schemas:**
  - `RequestSchema` - Fields
  - `ResponseSchema` - Fields

#### Frontend
- **New/Modified Pages:**
  - `/path` - Description
- **New/Modified Components:**
  - `ComponentName` - Description
- **State Management:**
  - Redux slice changes
  - Local state needs

#### Database
- **Schema Changes:**
  - New tables/columns
- **Migration Required:** Yes/No
- **Data Migration:** Details if needed

### API Contract
```json
// Request
{
  "field": "type"
}

// Response
{
  "field": "type"
}
```

### Error Handling
| Scenario | HTTP Code | User Message |
|----------|-----------|--------------|
| Invalid input | 400 | "Please check..." |
| Not found | 404 | "Could not find..." |
| Server error | 500 | "Something went wrong" |
```

### Phase 3: Backend Implementation

```markdown
## Backend Implementation Checklist

### Database (if needed)
- [ ] Create/update SQLAlchemy model in `backend/app/models/`
- [ ] Generate Alembic migration: `alembic revision --autogenerate -m "description"`
- [ ] Review generated migration for correctness
- [ ] Test migration: `alembic upgrade head`
- [ ] Test rollback: `alembic downgrade -1`

### Schemas
- [ ] Create request schema in `backend/app/schemas/`
- [ ] Create response schema in `backend/app/schemas/`
- [ ] Use camelCase aliases for frontend: `Field(alias="fieldName")`
- [ ] Add `model_config = ConfigDict(populate_by_name=True)`

### Service Layer
- [ ] Implement business logic in `backend/app/services/`
- [ ] Service receives Pydantic schemas or primitives
- [ ] Service returns appropriate data (not HTTP responses)
- [ ] Add proper error handling
- [ ] Add logging where appropriate

### Route Handler
- [ ] Create/update route in `backend/app/routes/`
- [ ] Route handles HTTP only (no business logic)
- [ ] Add `Depends(get_current_user)` if protected
- [ ] Use Pydantic schemas for validation
- [ ] Return appropriate HTTP status codes
- [ ] Handle errors with HTTPException

### Testing
- [ ] Add unit tests for service logic
- [ ] Add integration tests for API endpoint
- [ ] Test happy path
- [ ] Test error cases
- [ ] Test edge cases
```

### Phase 4: Frontend Implementation

```markdown
## Frontend Implementation Checklist

### Types
- [ ] Update TypeScript types in `frontend/src/lib/types.ts`
- [ ] Types match API response schemas exactly
- [ ] No use of `any` type

### API Client
- [ ] Add API function in `frontend/src/lib/api/`
- [ ] Use proper error handling
- [ ] Return typed responses

### State Management
- [ ] If cross-page state: Update Redux slice
- [ ] If local state: Use useState
- [ ] Handle loading state
- [ ] Handle error state

### Components
- [ ] Use Server Components by default
- [ ] Only use "use client" when needed (hooks, events)
- [ ] Implement loading states
- [ ] Implement error states
- [ ] Handle empty states
- [ ] Use Tailwind for styling (no inline styles)

### Testing
- [ ] Add component tests where valuable
- [ ] Test user interactions
- [ ] Test error handling UI
```

### Phase 5: Integration & Validation

```markdown
## Integration Checklist

### End-to-End Flow
- [ ] Test complete user flow from UI to database
- [ ] Verify data persists correctly
- [ ] Verify UI updates correctly
- [ ] Test with realistic data

### Error Handling
- [ ] Test network errors
- [ ] Test validation errors
- [ ] Test server errors
- [ ] Verify error messages are helpful

### Edge Cases
- [ ] Test with empty data
- [ ] Test with maximum data
- [ ] Test rapid repeated actions
- [ ] Test concurrent users (if applicable)

### Performance
- [ ] Check for N+1 queries
- [ ] Verify reasonable response times
- [ ] Check bundle size impact (frontend)
```

---

## Architecture Rules

### Backend Architecture

```
Request → Route (HTTP only) → Service (logic) → Model (DB) → Response
                    ↓
              Pydantic Schema (validation)
```

| Layer | Responsibility | Anti-Pattern |
|-------|---------------|--------------|
| Routes | HTTP handling, validation | Business logic in routes |
| Services | Business logic | Direct DB access in routes |
| Models | Database schema | Logic in models |
| Schemas | Validation, serialization | Missing validation |

### Frontend Architecture

```
Page → Component → API Client → Redux/State → UI Update
```

| Pattern | When to Use | Anti-Pattern |
|---------|-------------|--------------|
| Server Component | Static content, data fetching | Client Component for static |
| Client Component | Hooks, events, browser APIs | Unnecessary "use client" |
| Redux | Cross-page state | Redux for local UI state |
| useState | Local UI state | Prop drilling for deep state |

---

## Common Patterns

### Backend: Service Method

```python
# backend/app/services/feature.py
class FeatureService:
    @staticmethod
    async def create(db: AsyncSession, data: CreateRequest) -> Feature:
        """Create a new feature."""
        feature = Feature(**data.model_dump())
        db.add(feature)
        await db.commit()
        await db.refresh(feature)
        return feature
```

### Backend: Route Handler

```python
# backend/app/routes/feature.py
@router.post("/", response_model=FeatureResponse)
async def create_feature(
    data: CreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
) -> FeatureResponse:
    """Create a new feature."""
    feature = await FeatureService.create(db, data)
    return FeatureResponse.model_validate(feature)
```

### Frontend: API Client

```typescript
// frontend/src/lib/api/feature.ts
export async function createFeature(data: CreateRequest): Promise<Feature> {
  const response = await apiClient.post<Feature>('/api/features', data);
  return response.data;
}
```

### Frontend: Component

```typescript
// Server Component (default)
export default async function FeaturePage() {
  const data = await fetchFeatures();
  return <FeatureList features={data} />;
}

// Client Component (when needed)
"use client";
export function FeatureForm() {
  const [loading, setLoading] = useState(false);
  // ... event handlers
}
```

---

## Forbidden Actions

```markdown
## NEVER DO THESE

❌ Start coding before requirements are clear
❌ Put business logic in route handlers
❌ Skip database migration for schema changes
❌ Use "any" type in TypeScript
❌ Use Client Component for static content
❌ Forget error handling
❌ Forget loading states
❌ Skip tests
❌ Hardcode configuration values
❌ Mix feature work with unrelated changes
```

---

## Risks and Gotchas

| Risk | Mitigation |
|------|------------|
| Business logic in routes | Review architecture before committing |
| Missing auth on endpoints | Always add `Depends(get_current_user)` |
| Type mismatches | Generate types from schemas |
| Client Component overuse | Default to Server Component |
| Missing error states | Add error boundary, try-catch |
| Missing loading states | Always show loading indicator |
| Breaking API changes | Version endpoints if needed |

---

## Contingencies

### If Feature Scope Grows

1. Stop and reassess requirements
2. Break into smaller features
3. Document what's deferred
4. Get explicit approval for expanded scope

### If Integration Issues Found

1. Document the issue
2. Check if it's a known bug (BUG_REGISTRY.md)
3. Fix if simple, otherwise create separate issue
4. Don't block feature on unrelated bugs

### If Performance Issues Detected

1. Profile to find bottleneck
2. Document the issue
3. Fix if simple optimization
4. Create separate issue for complex fixes

---

## Expected Artifacts

After completing feature:

```markdown
## Feature Completion Report

### Feature: [Name]

### Files Changed
- backend/app/models/feature.py (new)
- backend/app/schemas/feature.py (new)
- backend/app/services/feature.py (new)
- backend/app/routes/feature.py (new)
- frontend/src/lib/types.ts (modified)
- frontend/src/app/features/page.tsx (new)

### API Endpoints
- POST /api/features - Create feature
- GET /api/features - List features
- GET /api/features/{id} - Get feature

### Tests Added
- test_feature_create.py
- test_feature_list.py

### Verification
- [ ] Manual testing completed
- [ ] All tests pass
- [ ] Linting passes
- [ ] Type checking passes

### Notes
Any caveats, known issues, or follow-up work.
```

---

## Key Files Reference

| Area | Files |
|------|-------|
| Backend Routes | `backend/app/routes/` |
| Backend Services | `backend/app/services/` |
| Backend Models | `backend/app/models/` |
| Backend Schemas | `backend/app/schemas/` |
| Backend Tests | `backend/tests/` |
| Frontend Pages | `frontend/src/app/` |
| Frontend Components | `frontend/src/components/` |
| Frontend State | `frontend/src/store/` |
| Frontend API | `frontend/src/lib/api/` |
| Frontend Types | `frontend/src/lib/types.ts` |

---

_Last updated: 2026-01-20_
