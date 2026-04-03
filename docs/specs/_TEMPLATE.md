---
id: SPEC-NNN
title: "Feature Title"
phase: 1
status: draft
priority: P0 | P1 | P2
complexity: S | M | L | XL
created: YYYY-MM-DD
updated: YYYY-MM-DD
depends-on: []
branch: feat/SPEC-NNN-slug
feasibility: pending
---

# SPEC-NNN: Feature Title

## 1. Overview

**Problem:** What user problem does this solve?

**Solution:** One-paragraph description of the approach.

**Fits the vision because:** How this connects to "chat app with financial intelligence."

## 2. User Stories

- As a [user type], I want to [action], so that [benefit].

## 3. Acceptance Criteria

Each criterion MUST be binary (pass/fail) and testable by the spec-verifier.

- [ ] AC-1: [Specific, measurable criterion]
- [ ] AC-2: [Specific, measurable criterion]
- [ ] AC-3: [Specific, measurable criterion]

## 4. Data Model

### New Tables
Describe any new tables here with full SQL including RLS.

### Modified Tables
- table_name: Add column column_name (type) — reason

## 5. API Contracts

### Endpoint Name
POST /api/endpoint
Authorization: Bearer {token}

Request:  { "field": "type — description" }
Response: { "field": "type — description" }
Errors:   400 validation_error | 401 unauthorized | 404 not_found

## 6. UI/UX Specifications

### Screen: Screen Name
- Layout, components, NativeWind classes
- Interactions (tap, swipe, long-press)
- Loading / empty / error states

### Navigation Flow
Screen A → (action) → Screen B → (error) → Error Modal

## 7. Edge Cases

| # | Scenario | Expected Behavior |
|---|----------|-------------------|
| 1 | ... | ... |

## 8. Error Handling

| Error | User-Facing Message | Technical Detail |
|-------|---------------------|------------------|
| ... | ... | ... |

## 9. Dependencies

- **Requires:** SPEC-NNN (must complete first)
- **Blocks:** SPEC-NNN (this before that)
- **Related:** SPEC-NNN (shares components)

## 10. Complexity Estimate

- Frontend: S/M/L
- Backend: S/M/L
- Testing: S/M/L
- Total: S/M/L/XL

## 11. Testing Strategy

- Unit tests: [what to unit test]
- Integration tests: [what to integration test]
- E2E tests: [critical user flows to cover]

## 12. Feasibility Check Results

| Check | Status | Notes |
|-------|--------|-------|
| Schema Compatibility | PENDING | — |
| API Compatibility | PENDING | — |
| Dependency Verification | PENDING | — |
| Phase Alignment | PENDING | — |

**Verdict:** PENDING
**Blockers:** None identified yet

## 13. Open Questions

- [ ] [Unresolved questions before dev starts]
