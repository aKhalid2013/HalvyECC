# Halvy — Claude Code Configuration

See @AGENTS.md for universal project rules.

## Deep Context (loaded on-demand via @imports)
- Product requirements: @docs/prd/README.md
- Database schema: @docs/schema/README.md
- API contracts: @docs/api/README.md
- Design system: @docs/design-system/README.md
- Phase roadmap: @docs/phases/README.md
- AI integration: @docs/ai-integration/README.md
- Spec registry: @docs/specs/_INDEX.md
- Spec template: @docs/specs/_TEMPLATE.md

## Spec-Driven Workflow
1. Use the product-owner agent to brainstorm feature X
2. PO Agent produces spec → feasibility check → you approve
3. /plan "Implement SPEC-NNN"
   → agent writes docs/plans/SPEC-NNN-tasks.md and STOPS
   → you review the task list and approve it
4. /tdd TASK-1 SPEC-NNN → implement → /code-review (per task or at end)
   → /tdd TASK-2 SPEC-NNN (new session) → repeat per task
5. Use the spec-verifier agent on SPEC-NNN

## Agent Teams (for parallel feature work)
Enable: CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
Pattern: spawn teammates per-spec on separate git worktrees.
Each teammate works on its own branch: feat/SPEC-{NNN}-slug

## Agents Available
- product-owner — Feature brainstorming, feasibility check, spec production
- spec-verifier — Post-dev implementation vs spec verification

## Skills Available

### Halvy Core Skills (project-specific)
- po-agent — Product Owner workflow
- spec-verifier — Verification workflow
- halvy-context — Project context loader
- halvy-expense-logic — Living balance model, split types, integer cents, debt graph
- react-native-expo — RN/Expo patterns, NativeWind v4, FlashList, Reanimated 3, safe areas
- expo-mobile — Expo/React Native quick-reference patterns
- mobile-e2e — Detox + Maestro E2E testing for mobile flows

### State & Data Skills
- zustand-patterns — Store creation, slices, persistence, auth sign-out reset
- react-query-patterns — TanStack Query v5, query-key-factory, optimistic updates, Supabase invalidation
- zod-patterns — Runtime validation at all external boundaries (Supabase, Gemini, forms)
- monetary-patterns — Dinero.js v2, integer cents, equal split, display formatting

### Styling Skills
- nativewind-patterns — NativeWind v4 className usage, dark mode, design tokens, forbidden patterns

### Testing Skills
- supabase-integration-testing — RLS policy tests against local Supabase instance
- playwright-web-e2e — Playwright E2E for Expo web, Page Object Model, multi-browser
- maestro-flows — Maestro YAML flows for iOS/Android, CI with EAS
- universal-e2e — One test suite for iOS + Android (Detox) + Web (Playwright)
- storybook-rn — Per-component stories as definition-of-done, Chromatic CI integration
- ai-evals — PromptFoo evals for Gemini receipt parser and voice dictation

### From ECC (general-purpose)
- postgres-patterns — Supabase/PostgreSQL query optimization, indexes, RLS
- api-design — REST conventions, pagination, error envelopes
- tdd-workflow — Full TDD loop enforcement
- database-migrations — Safe schema changes, zero-downtime patterns, Supabase migration workflow
- security-review — Auth, RLS, input validation, secrets, rate limiting checklists
- security-scan — Audit .claude/ config for misconfigs and injection risks (AgentShield)

## Contexts (behavioral mode switching)
- `.claude/contexts/dev.md` — Active coding mode: write first, explain after, atomic commits
- `.claude/contexts/review.md` — PR review mode: severity-grouped findings, Halvy-specific checks
- `.claude/contexts/research.md` — Discovery mode: read before writing, cite sources, present trade-offs

Usage: Reference a context at the start of a task — e.g. "Use dev context" or "Use review context for this PR."

## MCP Servers
Configured in `~/.claude/settings.json` under `mcpServers`:
- **supabase** — Query schema, RLS policies, run SQL directly. Replace `YOUR_SUPABASE_PROJECT_REF` with your project ref before using.
- **memory** — Persist facts across sessions (approved specs, phase state, architectural decisions)
- **sequential-thinking** — Chain-of-thought reasoning for complex planning tasks
- **context7** — Fetch live library docs (Expo, Supabase, Zustand, TanStack Query, Zod, NativeWind). See Docs Policy in AGENTS.md. Requires API key from context7.com/dashboard.

## Slash Command Boundaries (enforced)

/plan  — Output only. Writes docs/plans/SPEC-NNN-tasks.md and STOPS.
         No source files. No tests. No implementation.
         Final output is always the ✅ PLAN COMPLETE stop message.

/tdd   — Always called as: /tdd TASK-N SPEC-NNN
         Reads TASK-N from docs/plans/SPEC-NNN-tasks.md.
         Implements exactly one task. STOPS after marking it done.
         Does NOT chain to TASK-N+1 automatically.

These commands are separated by a human approval step.
They never run back-to-back without developer action between them.
