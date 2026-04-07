# Halvy — Project Instructions

## Identity
Halvy: chat-first social expense-splitting app for Gen Z.
"A chat app with financial intelligence, not a finance app with chat."

## Stack
Expo (React Native) · Expo Router v3 · Supabase · NativeWind v4 · Zustand · Gemini API
Testing: Jest + React Native Testing Library + Detox (E2E)

## Commands
npm run start          # Expo dev server
npm run test           # Jest
npm run test:e2e       # Detox E2E
npm run lint           # ESLint + Prettier
npm run typecheck      # TypeScript strict

## Architecture
- Feature-based: src/features/{name}/ with components/, hooks/, utils/, types/, __tests__/
- Shared code: src/components/ (shared UI), src/providers/, src/stores/, src/api/
- Max file: 300 lines. Split at 200.
- Functional components + hooks only. No class components.
- Supabase RLS mandatory on all tables.
- Zod for runtime validation at boundaries.
- All monetary values stored and computed in integer cents. No floats in financial logic.
- FlashList over FlatList for chat and activity lists.
- Gemini API calls go through the Supabase ai-proxy Edge Function only. Never call Gemini directly from the client.

## Code Style
- TypeScript strict. No any.
- const over let. No var.
- Named exports only (except screen defaults).
- Error boundaries on every screen.

## Git
- Commit: <type>(scope): <description>
- Branch: <type>/<spec-id>-<short-description>
- PR references spec: "Implements SPEC-NNN"

## Spec-Driven Development
Every feature requires an approved spec in docs/specs/ before code is written.
Specs follow docs/specs/_TEMPLATE.md format.
Post-dev: spec-verifier agent checks implementation vs spec before merge.

## Key Docs (read on-demand)
- Product vision: docs/prd/
- Schema: docs/schema/
- API contracts: docs/api/
- Design system: docs/design-system/
- Phase roadmap: docs/phases/
- AI integration: docs/ai-integration/
- Feature specs: docs/specs/

## Development Gates

The /plan → /tdd workflow is human-approval-gated.
Commands are atomic units. They do NOT chain automatically.

### /plan contract
Output: writes docs/plans/SPEC-NNN-tasks.md
Then: prints ✅ PLAN COMPLETE stop message
Then: HALTS — no code, no src/ files, no tests, no further action
Gate: developer reviews task list → checks approval checklist → runs /tdd

### /tdd contract
Syntax: /tdd TASK-N SPEC-NNN
Reads: docs/plans/SPEC-NNN-tasks.md (the TASK-N entry only)
Does: implements exactly one task using TDD (RED → GREEN → REFACTOR)
Then: marks TASK-N Status: ✅ done in the task list file
Then: HALTS — prints "TASK-N complete. Run /tdd TASK-N+1 SPEC-NNN."
Does NOT: chain to the next task automatically

### Naming rule
Tasks inside docs/plans/ are called TASK-1, TASK-2, ... TASK-N.
The word "Phase" is NEVER used for tasks.
"Phase" belongs only in docs/phases/ (app release strategy).
