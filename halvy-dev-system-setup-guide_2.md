# Halvy Dev System — Full Installation Guide

**For:** Ahmed (Windows · Claude Code installed · empty GitHub repo)
**Covers:** Everything from cloning the repo to your first PO Agent session
**Time estimate:** ~90–120 minutes end to end

---

## What You're Building

By the end of this guide you will have:

- A fully structured local repo with all agent config files in place
- ECC (Everything Claude Code) rules installed and the ECC plugin active in Claude Code
- Claude Code and Antigravity reading from one shared skills source
- Your 9 spec docs in `docs/` (ready for Claude Code and PO Agent to read)
- The spec registry, spec template, and PO-CONTEXT generator script in place
- The Claude.ai Project set up with Layer 1 knowledge loaded
- The GitHub Action that auto-regenerates PO-CONTEXT.md on a schedule
- Agent Teams enabled in Claude Code settings
- A verified working dev loop you can test right now

---

## Before You Start — Checklist

Confirm you have these ready before touching a terminal:

- [ ] Your GitHub repo URL (e.g. `https://github.com/aKhalid2013/HalvyECC`)
- [ ] Your Supabase project ID for `halvy-dev` (found in Supabase dashboard → Settings → General → Reference ID — looks like `abcdefghijklm`)
- [ ] Your Gemini API key (from Google AI Studio)
- [ ] Your Supabase anon key and project URL (from Supabase → Settings → API)
- [ ] Claude Code working — confirm by opening any terminal and running `claude --version`

> **Windows note:** All terminal steps in this guide use **PowerShell**. Do not use Command Prompt (cmd.exe) — some commands will not work there. Right-click the Start menu → "Windows PowerShell" or open it from Windows Terminal.

---

## Phase 1 — Clone & Initial Structure

### Step 1 — Clone the repo

Open PowerShell and run:

```powershell
git clone https://github.com/aKhalid2013/HalvyECC.git
cd Halvy
```

Confirm you're in the right place:

```powershell
pwd
# Should print something like: C:\Users\Ahmed\Halvy
```

### Step 2 — Create the full directory skeleton

Run each block in sequence. These create every folder the system needs:

```powershell
# Agent config directories
mkdir .agent-skills\po-agent
mkdir .agent-skills\spec-verifier
mkdir .agent-skills\expo-mobile
mkdir .agent-skills\halvy-context
mkdir .claude\agents
mkdir .claude\rules
mkdir .agent

# Documentation directories
mkdir docs\prd
mkdir docs\schema
mkdir docs\api
mkdir docs\design-system
mkdir docs\ai-integration
mkdir docs\phases
mkdir docs\specs\phase-1
mkdir docs\specs\phase-2
mkdir docs\specs\phase-3
mkdir docs\specs\phase-4
mkdir docs\specs\phase-5

# Script and workflow directories
mkdir scripts
mkdir .github\workflows
```

> **Why these folders:** The system design requires this exact structure. `docs/` holds your spec docs and agent-readable references. `.agent-skills/` is the single source of truth for all agent skills — both Claude Code and Antigravity will point to it. `.claude/agents/` holds the Claude Code subagent definitions.

---

## Phase 2 — Symlinks (Skills Shared Across Agents)

On Windows, symlinks require either running PowerShell as Administrator, or enabling Developer Mode (which lets any user create symlinks without elevation).

### Step 3 — Enable Developer Mode (one-time, recommended)

Go to: **Settings → System → For developers → Developer Mode → On**

This lets you create symlinks without needing to run as Administrator every time.

### Step 4 — Create the symlinks

In PowerShell (standard, not admin — as long as Developer Mode is on):

```powershell
# Link .claude/skills → .agent-skills (Claude Code reads from here)
cmd /c mklink /D .claude\skills ..\..\.agent-skills

# Link .agent/skills → .agent-skills (Antigravity reads from here)
cmd /c mklink /D .agent\skills ..\..\.agent-skills
```

Verify they were created:

```powershell
Get-Item .claude\skills
Get-Item .agent\skills
# Both should show as SymbolicLink pointing to .agent-skills
```

> **Why symlinks:** Both Claude Code (`.claude/skills/`) and Antigravity (`.agent/skills/`) expect to find skills in their own directories. Instead of maintaining two copies, both point to the single `.agent-skills/` directory. Edit a skill once, both tools see it instantly. Zero drift.

### Step 5 — Add .gitattributes so symlinks survive cloning

Create the file:

```powershell
@"
.claude/skills symlink=true
.agent/skills symlink=true
"@ | Out-File -FilePath .gitattributes -Encoding utf8
```

---

## Phase 3 — Core Agent Config Files

You will now create the files that every agent reads. Copy each block exactly.

### Step 6 — Create AGENTS.md (universal brief, read by all tools)

```powershell
@"
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
"@ | Out-File -FilePath AGENTS.md -Encoding utf8
```

### Step 7 — Create CLAUDE.md (Claude Code routing layer)

```powershell
@"
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
- po-agent — Product Owner workflow
- spec-verifier — Verification workflow
- expo-mobile — Expo/React Native patterns
- halvy-context — Project context loader

## MCP Servers
- Supabase: for querying schema and RLS policies directly
"@ | Out-File -FilePath CLAUDE.md -Encoding utf8
```

### Step 8 — Create GEMINI.md (Antigravity routing layer)

```powershell
@"
# Halvy — Antigravity Configuration

Read AGENTS.md for all universal project rules. That file is the source of truth.

Skills are in .agent/skills/ (symlinked from .agent-skills/).
Agent definitions for reference are in .claude/agents/.

Follow the same spec-driven workflow defined in AGENTS.md:
1. Every feature needs an approved spec in docs/specs/ before code
2. Post-dev: run spec-verifier workflow from .agent/skills/spec-verifier/SKILL.md
3. All monetary values in integer cents. No floats.
4. Gemini API calls via Supabase ai-proxy Edge Function only — never direct.
"@ | Out-File -FilePath GEMINI.md -Encoding utf8
```

---

## Phase 4 — Agent Definitions

### Step 9 — Create the Product Owner subagent

```powershell
@"
---
name: product-owner
description: >
  Product Owner agent for spec-driven development. Brainstorms features,
  runs technical feasibility checks, produces detailed specs with acceptance
  criteria. Full read access to codebase and docs. Triggers: "brainstorm",
  "feature idea", "write spec", "PO mode", "product owner".
tools:
  - Read
  - Glob
  - Grep
  - WebSearch
  - mcp__supabase
model: claude-opus-4-6
memory: project
---

You are the Product Owner for Halvy, a chat-first social expense-splitting
app targeting Gen Z users. Built on Expo (React Native), Supabase,
NativeWind v4, and Gemini API.

## Your Role

You work directly with the developer (Ahmed) to:
1. Brainstorm and explore feature ideas
2. Challenge assumptions and identify edge cases
3. Run a Technical Feasibility Check before finalizing any spec
4. Produce feature specs that development agents can execute

## Context Loading

Before any discussion, ground yourself in the following. These eight docs
are your static product brain — treat them as authoritative.

### Layer 1 — Static Product Brain

**1. PRD** — the constitution. Test every feature idea against "chat app
with financial intelligence, not a finance app with chat." Use the
out-of-scope list to push back on feature creep.

**2. schema** — the structural boundary. Entity relationships, XOR
constraints (payer vs placeholder), RLS permission matrix. Any feature
you propose must be compatible with the existing data layer.

**3. expense-logic** — the financial engine. Living balance model, split
types, largest remainder rounding, debt graph simplification, and the
integer-cents-only rule. Non-negotiable.

**4. phasing-strategy** — the roadmap. Phase-by-phase feature list and
exit criteria. Use to place a new feature in the correct phase.

**5. screens-and-navigation** — the UI surface map. Navigation graph,
inner tab structure. Use to know where a feature lives in the app.

**6. api-contracts** — endpoint conventions, error shapes, rate limits.
Verify proposed endpoints don't conflict with existing ones.

**7. ai-integration** — Gemini proxy architecture, OCR/voice pipelines,
server-side-only rule for API key handling.

**8. design-system** — tokens and component vocabulary. Reference
existing components rather than inventing from scratch.

### Layer 2 — Live Progress Monitor

At session start, read docs/PO-CONTEXT.md (auto-generated). This gives you:
- Spec registry: all SPEC-NNN entries with current status
- Verification summaries: PASS/FAIL/PARTIAL verdicts
- Phase completion percentages

If PO-CONTEXT.md is absent, ask Ahmed to run:
  node scripts/generate-po-context.js

### What is NOT in your context

- env-and-config — build secrets, EAS profiles. Builder-only.
- project-structure — file paths, import aliases. Builder-only.
- testing-strategy — Jest config, mocking patterns. You need results, not setup.
- migration-strategy — SQL rollback patterns. Builder-only.
- auth-flow (standalone) — already captured in PRD and schema.

## Brainstorming Mode

When exploring a feature idea:
- Ask clarifying questions about the user problem first
- Propose multiple approaches with tradeoffs
- Reference existing Halvy architecture
- Consider impact on the chat-first paradigm
- Identify dependencies on other features or specs
- Think about Gen Z user expectations
- Consider Islamic finance principles where relevant

Be opinionated. Push back on feature creep. Advocate for the simplest
version that validates the hypothesis. Never skip ahead without Ahmed's
explicit confirmation at each gate.

## ★ Technical Feasibility Check (MANDATORY before approval)

A spec CANNOT be marked as approved until this check passes.
Run automatically after Ahmed says "finalize" or "approve":

### Check 1: Schema Compatibility
- Read @docs/schema/README.md and compare against proposed data model
- Verify new tables don't conflict with existing ones
- Verify RLS policies are feasible with current auth model
- Flag any migration risks

### Check 2: API Compatibility
- Read @docs/api/README.md and check for endpoint conflicts
- Verify proposed endpoints follow existing conventions

### Check 3: Dependency Verification
- For each spec listed in "Dependencies", verify it exists and its status
- Flag any circular dependencies or unapproved prerequisites

### Check 4: Phase Alignment
- Verify the feature belongs in the assigned phase
- Check that prerequisite phases are complete or in-progress

### Feasibility Report Format
Output this table before marking any spec approved:

| Check | Status | Notes |
|-------|--------|-------|
| Schema Compatibility | PASS / FAIL | ... |
| API Compatibility | PASS / FAIL | ... |
| Dependency Verification | PASS / FAIL | ... |
| Phase Alignment | PASS / FAIL | ... |

**Verdict:** FEASIBLE / NOT FEASIBLE
**Blockers:** [list if any]

If NOT FEASIBLE: present blockers. Iterate until all checks pass.

## Spec Production Mode

When Ahmed says "let's write the spec":
1. Confirm scope from brainstorming session
2. Draft spec following @docs/specs/_TEMPLATE.md
3. Present section by section for review
4. Iterate on feedback
5. Run Technical Feasibility Check — MANDATORY
6. If feasible: save to docs/specs/{phase}/SPEC-{NNN}-{slug}.md
7. Update docs/specs/_INDEX.md status and feasibility columns

## Communication Style
- Direct and structured
- Concrete examples over abstractions
- Clear "Option A vs Option B" format for tradeoffs
- Always tie decisions back to: "chat app with financial intelligence"
"@ | Out-File -FilePath .claude\agents\product-owner.md -Encoding utf8
```

### Step 10 — Create the Spec Verifier subagent

```powershell
@"
---
name: spec-verifier
description: >
  Verifies completed feature implementation matches its approved spec.
  Compares acceptance criteria, data model, API contracts, and UI against
  actual code. Read-only — never modifies code. Triggers: "verify spec",
  "spec-verifier", "check implementation", "verify SPEC-NNN".
tools:
  - Read
  - Glob
  - Grep
model: claude-sonnet-4-6
---

You are a spec verification agent for Halvy. Your job is to compare a
completed feature's implementation against its approved spec and produce
a structured verification report. You NEVER modify code.

## Process

### Step 1: Load Spec
Read docs/specs/{phase}/SPEC-{NNN}-{slug}.md.
Parse: acceptance criteria, data model, API contracts, UI specs, edge cases.

### Step 2: Trace Implementation

**Acceptance Criteria:**
For each AC, find the implementing code AND a verifying test.
- PASS: code exists + test exists and passes
- PARTIAL: code exists, no test
- FAIL: not implemented

**Data Model:**
Compare spec SQL against actual Supabase migration files in supabase/migrations/.
Verify RLS policies match what the spec required.

**API Contracts:**
Find Edge Functions or API routes.
Compare request/response shapes against spec.
Verify error handling covers the spec's error table.

**UI/UX:**
Find screen and component files.
Verify navigation flow, NativeWind class usage, loading/empty/error states.

**Edge Cases:**
For each edge case in the spec, find handling code and confirm test coverage.

### Step 3: Produce Report

Output this exact format:

## Verification Report: SPEC-{NNN}

### Summary
- Verdict: PASS | FAIL | PARTIAL
- Coverage: X/Y acceptance criteria passing

### Acceptance Criteria
| AC | Description | Status | Evidence |
|----|-------------|--------|----------|
| AC-1 | ... | PASS/FAIL/PARTIAL | file.ts:line |

### Data Model
[Findings — migrations match or deviations]

### API Contracts
[Findings — shapes match or deviations]

### UI/UX
[Findings — screens match or deviations]

### Edge Cases
[Findings — handled or missing]

### Recommended Actions
1. [Specific fix or missing test]

---

After producing the report, update docs/specs/_INDEX.md:
- If PASS: change status to verified (✔️)
- If FAIL or PARTIAL: leave status as completed, add note

Save the report as: docs/specs/{phase}/SPEC-{NNN}.report.md
"@ | Out-File -FilePath .claude\agents\spec-verifier.md -Encoding utf8
```

---

## Phase 5 — Skills Files

### Step 11 — Create the PO Agent skill

```powershell
@"
---
name: po-agent
description: >
  Product Owner workflow: brainstorm features, run feasibility checks,
  write detailed specs. Triggers: "brainstorm", "feature idea",
  "write spec", "PO mode", "requirements".
---

# Product Owner Workflow

## When to Use
- Starting work on a new feature
- Exploring a feature idea before implementation
- Writing or updating a feature spec
- Making product decisions affecting multiple features

## Workflow

### Phase 1: Context Loading
1. Read docs/prd/ for product vision
2. Read docs/specs/_INDEX.md for existing specs and their statuses
3. Read docs/phases/ for current phase priorities
4. Read docs/PO-CONTEXT.md for live progress snapshot
5. Scan relevant src/ areas for implementation state

### Phase 2: Brainstorming (interactive)
1. Understand the user problem — ask before proposing
2. Explore multiple approaches with tradeoffs
3. Identify dependencies and edge cases
4. Converge on a solution — get explicit approval before writing spec

### Phase 3: Spec Writing
1. Use docs/specs/_TEMPLATE.md format exactly
2. Fill each section with specifics — no placeholders in final spec
3. Acceptance criteria must be binary (pass/fail) and testable
4. Reference design system, schema, API docs throughout
5. Assign spec ID: SPEC-{NNN} — check _INDEX.md for next available number

### Phase 4: Technical Feasibility Check — MANDATORY
Before marking any spec as approved:
1. Check schema compatibility (docs/schema/)
2. Check API compatibility (docs/api/)
3. Verify all dependencies exist and are in valid state
4. Verify phase alignment (docs/phases/)
5. Produce feasibility report
6. If NOT FEASIBLE — iterate on spec until all checks pass

### Phase 5: Finalize
1. Save to docs/specs/{phase}/SPEC-{NNN}-{slug}.md
2. Update docs/specs/_INDEX.md — status, feasibility, branch columns
3. Spec is ready for handoff to development agents
"@ | Out-File -FilePath .agent-skills\po-agent\SKILL.md -Encoding utf8
```

### Step 12 — Create the Spec Verifier skill

```powershell
@"
---
name: spec-verifier
description: >
  Verifies completed feature implementation against its approved spec.
  Read-only — never modifies code. Triggers: "verify", "spec-verifier",
  "check implementation", "verify SPEC-NNN".
---

# Spec Verifier Workflow

## When to Use
- After a Builder agent marks a feature as completed
- Before merging any feature branch
- When a spec status needs to move from completed to verified

## Workflow

### Step 1: Identify Spec
Get SPEC-NNN from the developer or from _INDEX.md entries with status: completed.
Read docs/specs/{phase}/SPEC-{NNN}-{slug}.md in full.

### Step 2: Trace Implementation
For each acceptance criterion:
- Find implementing code — record file:line
- Find verifying test — record file:line
- Assign status: PASS / PARTIAL / FAIL

Check data model against supabase/migrations/.
Check API contracts against Edge Function files.
Check UI against screen and component files.
Check edge case handling.

### Step 3: Write Report
Save to docs/specs/{phase}/SPEC-{NNN}.report.md
Update docs/specs/_INDEX.md status column.

### Verdict Rules
- PASS: all ACs pass, no critical deviations in data/API/UI
- PARTIAL: all ACs pass but some lack tests, or minor UI deviations
- FAIL: any AC fails, or critical data/API deviation found
"@ | Out-File -FilePath .agent-skills\spec-verifier\SKILL.md -Encoding utf8
```

### Step 13 — Create the Expo Mobile skill

```powershell
@"
---
name: expo-mobile
description: >
  Expo and React Native patterns for Halvy. Triggers: "component",
  "screen", "navigation", "expo", "NativeWind", "mobile", "React Native".
---

# Expo / React Native Development — Halvy Patterns

## Project Setup
- Expo SDK managed workflow with Expo Router v3
- NativeWind v4 (Tailwind CSS syntax)
- Supabase backend
- TypeScript strict mode
- FlashList (not FlatList) for all scrollable lists

## Feature File Structure
src/features/{name}/
  components/   — Feature-specific UI components
  hooks/        — TanStack Query hooks and local state hooks
  utils/        — Pure functions (no React)
  __tests__/    — Integration tests

## Critical Rules
- No window or document — not available in React Native
- No div/span/p — use View, Text, Pressable from react-native
- Always handle keyboard avoidance on input screens
- Always handle safe area insets
- Always use deep linking for navigable screens
- Use expo-image over Image for performance
- FlashList over FlatList for long lists — always
- All monetary amounts in integer cents — never floats

## NativeWind Rules
- className with Tailwind utilities on all RN components
- Platform-specific: className="ios:pt-2 android:pt-4"
- Dark mode: className="bg-white dark:bg-gray-900"
- Never mix StyleSheet.create with className in the same component
- Use design tokens from tailwind.config.ts

## Screen Pattern
import { ScrollView } from 'react-native'
import { Stack } from 'expo-router'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export default function FeatureScreen() {
  return (
    <ErrorBoundary>
      <Stack.Screen options={{ title: 'Feature' }} />
      <ScrollView className="flex-1 bg-background">
        {/* content */}
      </ScrollView>
    </ErrorBoundary>
  )
}

## Supabase Realtime Pattern (Chat)
useEffect(() => {
  const channel = supabase
    .channel('chat:' + groupId)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public',
      table: 'messages', filter: 'group_id=eq.' + groupId,
    }, handleNewMessage)
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}, [groupId])

## Monetary Arithmetic
// ALWAYS: convert to cents on entry, format on display only
const amountCents = Math.round(parseFloat(input) * 100)
// NEVER: parseFloat('1.10') + parseFloat('2.20') — float errors
"@ | Out-File -FilePath .agent-skills\expo-mobile\SKILL.md -Encoding utf8
```

### Step 14 — Create the Halvy Context Loader skill

```powershell
@"
---
name: halvy-context
description: >
  Loads Halvy project context from docs/. Use before significant dev tasks.
  Triggers: "load context", "project context", any reference to specs,
  schema, or architecture.
---

# Halvy Context Loader

## Loading Tiers

### Tier 1: Always (for any task)
1. AGENTS.md
2. docs/specs/_INDEX.md
3. docs/PO-CONTEXT.md (if present)

### Tier 2: Feature-specific (load when relevant)
4. docs/prd/ — when discussing product direction
5. docs/schema/ — when touching data layer
6. docs/api/ — when touching endpoints
7. docs/design-system/ — when touching UI
8. docs/ai-integration/ — when touching Gemini features
9. docs/phases/ — when checking phase alignment

### Tier 3: Implementation (load when coding)
10. src/shared/ — shared utilities, hooks, types
11. Specific src/features/{name}/ for the feature being worked on

## Usage
Tell any agent: "Load Halvy context for [area]"
- "for chat features" → Tier 1 + schema + existing chat code
- "for expense engine" → Tier 1 + schema + API + AI integration
- "for full overview" → Tier 1 + Tier 2 (no code)
"@ | Out-File -FilePath .agent-skills\halvy-context\SKILL.md -Encoding utf8
```

---

## Phase 6 — Spec Infrastructure

### Step 15 — Create the Spec Template

```powershell
@"
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
"@ | Out-File -FilePath docs\specs\_TEMPLATE.md -Encoding utf8
```

### Step 16 — Create the Spec Index

```powershell
@"
# Halvy Feature Specs — Registry

## Status Legend
- 🔵 draft — Being written by PO Agent
- 🟡 review — Awaiting developer approval
- 🔍 feasibility-check — Running technical feasibility check
- 🟢 approved — Feasibility passed, ready for development
- 🔶 in-progress — Currently being developed
- ✅ completed — Dev done, awaiting spec-verifier
- ✔️ verified — Spec verifier confirmed match

## Phase 1 — Foundation

| ID | Title | Status | Priority | Complexity | Feasibility | Branch |
|----|-------|--------|----------|------------|-------------|--------|
| — | No specs yet | — | — | — | — | — |

## Phase 2 — Groups & Chat

| ID | Title | Status | Priority | Complexity | Feasibility | Branch |
|----|-------|--------|----------|------------|-------------|--------|
| — | No specs yet | — | — | — | — | — |

## Phase 3 — Expenses & Balances

| ID | Title | Status | Priority | Complexity | Feasibility | Branch |
|----|-------|--------|----------|------------|-------------|--------|
| — | No specs yet | — | — | — | — | — |

## Phase 4 — AI Entry

| ID | Title | Status | Priority | Complexity | Feasibility | Branch |
|----|-------|--------|----------|------------|-------------|--------|
| — | No specs yet | — | — | — | — | — |

## Phase 5 — Payments & Polish

| ID | Title | Status | Priority | Complexity | Feasibility | Branch |
|----|-------|--------|----------|------------|-------------|--------|
| — | No specs yet | — | — | — | — | — |
"@ | Out-File -FilePath docs\specs\_INDEX.md -Encoding utf8
```

---

## Phase 7 — Spec Docs Into docs/

Your spec docs from the Claude.ai Project need to live in the repo so Claude Code and Antigravity can read them via `@imports`.

### Step 17 — Copy your spec docs into docs/

Each of the 8 Layer 1 docs gets its own subfolder with a `README.md`. This is what the `@imports` in CLAUDE.md point to.

For each doc below, copy the content from your Claude.ai Project files:

| Doc | Save to |
|-----|---------|
| PRD | `docs/prd/README.md` |
| Schema | `docs/schema/README.md` |
| Expense Logic | `docs/api/README.md` → **No** — save to `docs/schema/expense-logic.md` |
| Phasing Strategy | `docs/phases/README.md` |
| Screens & Navigation | `docs/prd/screens-and-navigation.md` |
| API Contracts | `docs/api/README.md` |
| AI Integration | `docs/ai-integration/README.md` |
| Design System | `docs/design-system/README.md` |

> **Practical way to do this:** Open each file from this Claude.ai Project (PRD_4.md, schema_5.md, etc.), copy the full content, and paste it into a new file at the path shown above. You can do this in VS Code or any text editor — you don't need the terminal for this step.

**Exact file mapping:**

| Project file | Destination in repo |
|---|---|
| `PRD_4.md` | `docs/prd/README.md` |
| `schema_5.md` | `docs/schema/README.md` |
| `expense-logic_4.md` | `docs/schema/expense-logic.md` |
| `phasing-strategy_4.md` | `docs/phases/README.md` |
| `screens-and-navigation_6.md` | `docs/prd/screens-and-navigation.md` |
| `api-contracts_3.md` | `docs/api/README.md` |
| `ai-integration_3.md` | `docs/ai-integration/README.md` |
| `design-system_2.md` | `docs/design-system/README.md` |

Also save the system design doc itself:

| File | Destination |
|---|---|
| `halvy-ecc-system-design-v3.md` | `docs/halvy-ecc-system-design-v3.md` |

---

## Phase 8 — PO-CONTEXT Generator Script

### Step 18 — Create generate-po-context.js

```powershell
@"
#!/usr/bin/env node
// scripts/generate-po-context.js
// Generates docs/PO-CONTEXT.md from three live repo sources:
//   1. docs/specs/_INDEX.md          -> spec registry + status
//   2. docs/specs/**/*.report.md     -> spec-verifier output
//   3. docs/phases/README.md         -> phase completion %

const fs   = require('fs');
const path = require('path');

const ROOT    = path.resolve(__dirname, '..');
const OUTPUT  = path.join(ROOT, 'docs', 'PO-CONTEXT.md');
const INDEX   = path.join(ROOT, 'docs', 'specs', '_INDEX.md');
const PHASES  = path.join(ROOT, 'docs', 'phases', 'README.md');
const REPORTS = path.join(ROOT, 'docs', 'specs');

// -- 1. Spec Registry
function extractSpecIndex() {
  if (!fs.existsSync(INDEX)) return '> docs/specs/_INDEX.md not found.\n';
  const lines = fs.readFileSync(INDEX, 'utf8').split('\n');
  return lines
    .filter(l => /^(#|##|\|)/.test(l.trim()))
    .join('\n');
}

// -- 2. Verification Reports
function extractVerificationSummaries() {
  const reports = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.report.md')) reports.push(full);
    }
  }
  walk(REPORTS);
  if (!reports.length) return '> No verification reports found yet.\n';

  return reports.map(f => {
    const content = fs.readFileSync(f, 'utf8');
    const specId  = content.match(/SPEC-(\d+)/)?.[0] ?? path.basename(f);
    const verdict = content.match(/\*\*Verdict:\*\*\s*(.+)/)?.[1] ?? 'unknown';
    const issues  = (content.match(/\|\s*(FAIL|PARTIAL)\s*\|.+/g) ?? [])
                      .map(l => '  - ' + l.trim()).join('\n');
    return '### ' + specId + '\n**Verdict:** ' + verdict + '\n' + (issues || '  *(no open issues)*');
  }).join('\n\n');
}

// -- 3. Phase Completion
function extractPhaseCompletion() {
  if (!fs.existsSync(PHASES)) return '> docs/phases/README.md not found.\n';
  const text   = fs.readFileSync(PHASES, 'utf8');
  const phases = text.split(/^## Phase \d/m).slice(1);
  const phaseHeaders = [...text.matchAll(/^## (Phase \d[^\n]*)/gm)].map(m => m[1]);

  return phaseHeaders.map((header, i) => {
    const block = phases[i] ?? '';
    const done  = (block.match(/- \[x\]/gi) ?? []).length;
    const total = (block.match(/- \[(x| )\]/gi) ?? []).length;
    const pct   = total ? Math.round((done / total) * 100) : 0;
    return '| ' + header + ' | ' + done + '/' + total + ' | ' + pct + '% |';
  }).join('\n');
}

// -- Assemble
const now = new Date().toISOString().slice(0, 16).replace('T', ' ');

const output = [
  '# PO-CONTEXT — Halvy Live Progress Snapshot',
  '_Generated: ' + now + ' UTC — do not edit manually_',
  '',
  '---',
  '',
  '## 1. Spec Registry',
  '',
  extractSpecIndex(),
  '',
  '---',
  '',
  '## 2. Verification Report Summaries',
  '',
  extractVerificationSummaries(),
  '',
  '---',
  '',
  '## 3. Phase Completion',
  '',
  '| Phase | Deliverables | Completion |',
  '|-------|-------------|------------|',
  extractPhaseCompletion(),
  '',
  '---',
  '_End of snapshot. Paste or upload this file at the start of a PO Agent session._',
].join('\n');

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, output);
console.log('PO-CONTEXT.md written to ' + path.relative(ROOT, OUTPUT));
"@ | Out-File -FilePath scripts\generate-po-context.js -Encoding utf8
```

Test it immediately:

```powershell
node scripts/generate-po-context.js
```

Expected output: `PO-CONTEXT.md written to docs\PO-CONTEXT.md`

Open `docs/PO-CONTEXT.md` and confirm it has the spec registry table and phase sections. It will show empty phase rows for now — that's correct.

---

## Phase 9 — GitHub Action for Auto-Sync

### Step 19 — Create the po-context-sync workflow

```powershell
@"
name: PO Context Sync

on:
  workflow_dispatch:
  push:
    branches: [main]
    paths:
      - 'docs/specs/**'
      - 'docs/phases/**'
      - 'docs/prd/**'
  schedule:
    - cron: '0 8 * * 1'  # Every Monday at 08:00 UTC

jobs:
  generate:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Generate PO-CONTEXT.md
        run: node scripts/generate-po-context.js

      - name: Commit if changed
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add docs/PO-CONTEXT.md
          git diff --staged --quiet || git commit -m "chore: regenerate PO-CONTEXT.md [skip ci]"
          git push
"@ | Out-File -FilePath .github\workflows\po-context-sync.yml -Encoding utf8
```

---

## Phase 10 — Install ECC (Everything Claude Code)

ECC is the development pipeline backbone. It provides the slash commands (`/plan`, `/tdd`, `/code-review`, `/security-scan`) that Builder agents use during feature development. It's separate from your Halvy repo — it installs globally into Claude Code.

### Step 20 — Clone the ECC repo and copy the rules

ECC rules need to live inside your Halvy repo's `.claude/rules/` folder so Claude Code picks them up automatically. Do this in PowerShell from your repo root:

```powershell
# Clone ECC into a temporary folder outside your repo
cd ..
git clone https://github.com/affaan-m/everything-claude-code.git
cd Halvy

# Copy the TypeScript and common rules into your .claude/rules/ folder
# (the rules/ folder was created in Phase 2, Step 2)
Copy-Item -Recurse -Force ..\everything-claude-code\rules\common .claude\rules\common
Copy-Item -Recurse -Force ..\everything-claude-code\rules\typescript .claude\rules\typescript
```

Verify the rules are in place:

```powershell
Get-ChildItem .claude\rules
# Should show two folders: common  typescript
```

> **Why copy instead of clone inside the repo:** Cloning directly into Halvy would create a nested git repo, which breaks git operations. You copy only the rules you need and leave the rest behind.

> **Which rules:** `common` = language-agnostic principles (file size limits, commit format, error handling). `typescript` = TypeScript/React Native-specific rules that match your stack exactly. You don't need any other rule sets from ECC.

You can now delete the temp ECC clone — you only needed the rules files:

```powershell
cd ..
Remove-Item -Recurse -Force everything-claude-code
cd Halvy
```

### Step 21 — Install the ECC plugin inside Claude Code

The plugin adds the slash commands (`/plan`, `/tdd`, `/code-review`, etc.) to Claude Code. Open PowerShell in your repo root and launch Claude Code:

```powershell
claude
```

Inside the Claude Code prompt, run these commands one at a time, waiting for each to complete before the next:

```
/plugin marketplace add affaan-m/everything-claude-code
```

```
/plugin install everything-claude-code@everything-claude-code
```

When installation finishes, confirm the commands are available:

```
/plan --help
```

You should see the planner command description. If you do, the plugin is installed correctly.

> **What these commands do in your workflow:**
> - `/plan` — reads a SPEC file + codebase and produces a step-by-step implementation plan for you to approve
> - `/tdd` — writes failing tests from acceptance criteria first, then guides implementation until tests pass
> - `/code-review` — reviews all changed files against the ECC rules you just installed
> - `/security-scan` — checks for security issues (exposed secrets, missing RLS, unsafe inputs)

Exit Claude Code for now (`/exit` or Ctrl+C):

```
/exit
```

### Step 22 — Verify the ECC rules are being loaded

Reopen Claude Code:

```powershell
claude
```

Ask it:

```
What coding rules are you following for this project?
```

It should mention TypeScript strict mode, file size limits, error boundaries, and Supabase RLS requirements — pulled from the rules you copied. If it does, ECC is wired up correctly.

---

## Phase 11 — Enable Agent Teams in Claude Code

### Step 23 — Update Claude Code settings

Find and open your Claude Code settings file. In PowerShell:

```powershell
notepad "$env:USERPROFILE\.claude\settings.json"
```

If the file doesn't exist yet, create it. Add or merge this block:

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

Save and close.

> **What this does:** Enables the Agent Teams feature, which lets you spawn multiple Claude Code subagents working in parallel on different specs in separate git worktrees. You won't use this on day one, but it needs to be on from the start.

---

## Phase 12 — Commit Everything to GitHub

### Step 24 — Initial commit

```powershell
git add .
git status
```

Review the list. You should see all the files you created. Then:

```powershell
git commit -m "chore: add Halvy ECC multi-agent dev system v3"
git push origin main
```

After pushing, go to your GitHub repo → Actions tab. You should see the `PO Context Sync` workflow listed. Run it manually once (click "Run workflow") to confirm it works end-to-end.

---

## Phase 13 — Claude.ai Project Setup (Layer 1)

This is the PO Agent's home. It's separate from Claude Code — it runs here in Claude.ai.

### Step 25 — Upload Layer 1 docs to this Project's knowledge

In this Claude.ai Project, go to **Project Knowledge** and upload these 8 files from your repo (the ones you created in Step 17):

| File to upload | What it gives the PO Agent |
|---|---|
| `docs/prd/README.md` | Product constitution |
| `docs/schema/README.md` | Database structure & constraints |
| `docs/schema/expense-logic.md` | Financial engine rules |
| `docs/phases/README.md` | Phase roadmap |
| `docs/prd/screens-and-navigation.md` | UI surface map |
| `docs/api/README.md` | API conventions |
| `docs/ai-integration/README.md` | Gemini proxy architecture |
| `docs/design-system/README.md` | Component vocabulary |

Also upload:
- `docs/specs/_TEMPLATE.md` — so the PO Agent knows the spec format
- `docs/halvy-ecc-system-design-v3.md` — so the PO Agent understands the workflow it's part of

> **When to re-upload:** Only when you update a spec doc itself (e.g. PRD goes to v5, schema goes to v6). These are stable documents — you won't re-upload them often.

### Step 26 — Start each PO session with PO-CONTEXT.md

Every time you open a new chat in this Project to do PO work:

1. Run locally: `node scripts/generate-po-context.js`
2. Open `docs/PO-CONTEXT.md`
3. Copy its contents and paste it into your first message, or upload the file

This gives the PO Agent the live snapshot of what specs exist and what phase you're in.

---

## Phase 14 — Verify the Full System

### Step 27 — Smoke test Claude Code

Open PowerShell in your repo root and launch Claude Code:

```powershell
claude
```

Inside Claude Code, run:

```
What project am I working on and what is the development workflow?
```

Claude Code should read `CLAUDE.md` → `AGENTS.md` and describe Halvy, the spec-driven workflow, and the available agents. If it does, the config is loading correctly.

Then test the product-owner agent:

```
Use the product-owner agent. What docs do you have access to, and what phase should I focus on first?
```

The agent should reference the Layer 2 context (PO-CONTEXT.md if you've placed it in docs/) and the Layer 1 docs via the `@imports` in CLAUDE.md.

### Step 28 — Smoke test Antigravity

Open your repo in Antigravity. Start a session and ask:

```
What project is this? What are the development rules and workflow?
```

Antigravity reads `AGENTS.md` automatically. It should describe Halvy correctly. If it does, the config is loading.

Then confirm it can see the skills:

```
Read .agent/skills/po-agent/SKILL.md and tell me the workflow phases.
```

It should return the 5-phase PO workflow. If it does, the symlink is working.

---

## What You Now Have

| Component | Location | Status |
|---|---|---|
| Universal agent brief | `AGENTS.md` | ✅ |
| Claude Code config | `CLAUDE.md` | ✅ |
| Antigravity config | `GEMINI.md` | ✅ |
| ECC common rules | `.claude/rules/common/` | ✅ |
| ECC TypeScript rules | `.claude/rules/typescript/` | ✅ |
| ECC plugin (slash commands) | Claude Code global install | ✅ |
| Shared skills source | `.agent-skills/` | ✅ |
| Claude Code skills symlink | `.claude/skills/` | ✅ |
| Antigravity skills symlink | `.agent/skills/` | ✅ |
| Product Owner subagent | `.claude/agents/product-owner.md` | ✅ |
| Spec Verifier subagent | `.claude/agents/spec-verifier.md` | ✅ |
| Spec template | `docs/specs/_TEMPLATE.md` | ✅ |
| Spec index | `docs/specs/_INDEX.md` | ✅ |
| PO-CONTEXT generator | `scripts/generate-po-context.js` | ✅ |
| GitHub Action auto-sync | `.github/workflows/po-context-sync.yml` | ✅ |
| Agent Teams enabled | `~/.claude/settings.json` | ✅ |
| Layer 1 docs in Claude.ai | Project Knowledge | ✅ |
| All 8 spec docs in repo | `docs/` subfolders | ✅ |

---

## Your First Real Workflow

Once setup is complete, here's how to start your first feature:

**In this Claude.ai Project (PO work):**
1. Run `node scripts/generate-po-context.js` → upload `docs/PO-CONTEXT.md`
2. Say: *"Use the product-owner agent. I want to brainstorm SPEC-001 — the auth flow for Phase 1."*
3. Iterate until you have an approved spec with a feasibility PASS
4. The spec gets saved to `docs/specs/phase-1/SPEC-001-auth.md`

**In Claude Code (Builder work):**
1. `cd Halvy && claude`
2. Say: *"/plan Implement SPEC-001"*
3. Agent reads the spec → produces a plan → you approve → dev begins

That's the full loop.

---

## Troubleshooting

**`/plan` or `/tdd` command not found in Claude Code:**
The ECC plugin didn't install correctly. Reopen Claude Code and re-run `/plugin install everything-claude-code@everything-claude-code`. If the marketplace command fails, check your internet connection and try again.

**Claude Code doesn't mention TypeScript rules when asked:**
The ECC rules files may not be in the right place. Run `Get-ChildItem .claude\rules` — you should see `common` and `typescript` folders. If they're missing, redo Step 20.


**Symlink shows as a regular directory instead of a symlink:**
Run PowerShell as Administrator and retry Step 4, or confirm Developer Mode is enabled in Windows Settings.

**Claude Code doesn't seem to read CLAUDE.md:**
Confirm the file is in the repo root (same folder as `package.json` will be). Claude Code reads `CLAUDE.md` from the working directory it's launched from.

**`node scripts/generate-po-context.js` fails with "Cannot find module":**
Confirm you are running the command from the repo root, not from inside the `scripts/` folder.

**GitHub Action fails on the commit step:**
Confirm the workflow has `permissions: contents: write` (already included in Step 19). If it still fails, check your repo's Settings → Actions → General → Workflow permissions → set to "Read and write permissions".

**Antigravity doesn't see skills:**
Confirm `.agent/skills` is a symlink pointing to `.agent-skills/`. In PowerShell: `Get-Item .agent\skills` — should show `SymbolicLink`. If it shows as a regular folder, delete it and redo Step 4.
