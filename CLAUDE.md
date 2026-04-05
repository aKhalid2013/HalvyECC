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
4. /tdd → implement → /code-review → /security-scan
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

### From ECC (general-purpose)
- postgres-patterns — Supabase/PostgreSQL query optimization, indexes, RLS
- api-design — REST conventions, pagination, error envelopes
- tdd-workflow — Full TDD loop enforcement

## MCP Servers
- Supabase: for querying schema and RLS policies directly
