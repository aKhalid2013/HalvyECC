# Halvy — ECC-Based Multi-Agent Development System

## System Design & Implementation Guide

**Version:** 3.0
**Date:** April 2, 2026
**Project:** Halvy — Chat-first social expense-splitting app
**Stack:** Expo (React Native) · Supabase · NativeWind · Gemini API
**Agent Platforms:** Claude Code · Google Antigravity · OpenAI Codex CLI

---

## Changelog

### v3.0 (April 2, 2026)

| # | Refinement | What Changed |
|---|-----------|--------------|
| 5 | **PO Agent Context Architecture** | Defined a two-layer context model: Layer 1 (static product brain — 8 canonical docs loaded into Claude.ai Project Knowledge) and Layer 2 (live progress monitor — `PO-CONTEXT.md` auto-generated from repo). Replaces manual doc pasting. |
| 6 | **Expanded `generate-po-context.js`** | Script now pulls three data sources: spec registry status from `_INDEX.md`, structured verification reports from spec-verifier output, and phase completion % by counting `- [x]` vs `- [ ]` in phasing-strategy. |
| 7 | **PO Agent Rationale per Doc** | Section 5.1 now documents *why* each Layer 1 doc is included and which docs are explicitly excluded (and why) to keep the agent's context window focused and guard against context window noise. |

### v2.0 (April 2, 2026)

| # | Refinement | What Changed |
|---|-----------|--------------|
| 1 | **Universal Brief + @import** | CLAUDE.md now uses `@imports` for lean context loading. AGENTS.md stays brief; deep docs are pulled on-demand. |
| 2 | **Symlink over Sync** | Replaced `sync-skills.sh` with a single `.agent-skills/` directory symlinked from both `.claude/skills` and `.agent/skills`. Zero drift. |
| 3 | **PO Feasibility Guardrail + MCP** | PO Agent must pass a Technical Feasibility Check before marking specs approved. MCP integrations (Google Drive, Figma) enable real-time context. |
| 4 | **Agent Teams Parallelization** | Added Claude Code Agent Teams and git worktree patterns for safe multi-agent parallel execution. |

---

## 1. System Overview

This document defines a complete development system for Halvy that combines three layers:

1. **Product Owner (PO) Agent Layer** — Spec-driven development: brainstorm, define, iterate, and produce detailed feature specs before any code is written.
2. **ECC Agent Harness Layer** — Everything Claude Code's multi-agent workflow (plan → TDD → code-review → verify) consumes PO specs and executes development.
3. **Cross-Platform Agent Coordination Layer** — A single repo structure that works identically across Claude Code, Antigravity, and Codex CLI.

The workflow is linear and approval-gated:

```
You (Product Owner) ←→ PO Agent (brainstorm/iterate)
        ↓ [approval gate 1: draft spec]
    PO Agent runs Technical Feasibility Check ← NEW in v2
        ↓ [approval gate 2: final spec — requires feasibility PASS]
    Feature Spec handed to ECC agents
        ↓
    planner → tdd-guide → code-reviewer → security-reviewer
        ↓
    Spec Verifier Agent checks implementation vs spec
        ↓ [approval gate 3: verification]
    Merge / Ship
```

---

## 2. Repository Structure

### 2.1 Cross-Platform Agent Configuration

The repo uses a layered configuration structure so that Claude Code, Antigravity, and Codex all read the same rules and skills from a single source.

**Key change in v2:** Skills live in a single `.agent-skills/` directory. Both `.claude/skills` and `.agent/skills` are symlinks pointing to it. No sync script, no drift.

```
halvy/
├── AGENTS.md                         # Universal brief — ALL tools read this
├── CLAUDE.md                         # Claude Code: lean file with @imports
├── GEMINI.md                         # Antigravity overrides (optional)
├── .codex/
│   └── config.toml                   # Codex config (falls back to AGENTS.md)
│
├── .agent-skills/                    # ★ SINGLE SOURCE for all skills
│   ├── po-agent/
│   │   └── SKILL.md
│   ├── spec-verifier/
│   │   └── SKILL.md
│   ├── expo-mobile/
│   │   └── SKILL.md
│   └── halvy-context/
│       └── SKILL.md
│
├── .claude/
│   ├── skills -> ../.agent-skills    # ★ SYMLINK to .agent-skills/
│   ├── rules/                        # Claude Code rules (from ECC)
│   │   ├── common/                   # Language-agnostic principles
│   │   └── typescript/               # TypeScript/React Native rules
│   └── agents/                       # Claude Code subagents
│       ├── product-owner.md
│       └── spec-verifier.md
│
├── .agent/
│   └── skills -> ../.agent-skills    # ★ SYMLINK to .agent-skills/
│
├── docs/
│   ├── prd/                          # Existing Halvy PRD
│   ├── schema/                       # Database schema docs
│   ├── api/                          # API contracts
│   ├── design-system/                # Design system docs
│   ├── ai-integration/               # Gemini AI integration specs
│   ├── phases/                       # Phasing strategy (Phases 0–9)
│   └── specs/                        # Feature specs produced by PO Agent
│       ├── _TEMPLATE.md              # Spec template
│       ├── _INDEX.md                 # Spec registry & status tracker
│       ├── phase-0/
│       │   ├── SPEC-001-auth.md
│       │   └── SPEC-002-chat-core.md
│       ├── phase-1/
│       └── ...
│
└── src/                              # Halvy source code
    └── ...
```

### 2.2 Symlink Setup (replaces sync script)

```bash
#!/bin/bash
# scripts/setup-skill-links.sh
# Run once during project setup. Creates symlinks so all tools
# read skills from the same .agent-skills/ directory.

# Create the canonical skills directory
mkdir -p .agent-skills

# Claude Code symlink
mkdir -p .claude
ln -sfn ../.agent-skills .claude/skills

# Antigravity symlink
mkdir -p .agent
ln -sfn ../.agent-skills .agent/skills

echo "✓ Skills symlinked: .claude/skills → .agent-skills/"
echo "✓ Skills symlinked: .agent/skills  → .agent-skills/"
echo "Edit skills in .agent-skills/ — both tools see changes instantly."
```

Add to `.gitattributes` so symlinks survive cloning:

```
.claude/skills symlink=true
.agent/skills symlink=true
```

---

## 3. AGENTS.md — The Universal Brief

AGENTS.md is the cross-platform instruction layer that Claude Code, Antigravity, and Codex all read automatically.

**v2 principle: Keep it under 150 lines.** Research shows LLMs reliably follow ~150 distinct instructions. The AGENTS.md should contain only the essentials. Deep documentation lives in `docs/` and is pulled in on-demand via `@imports` in CLAUDE.md or by agent skills.

```markdown
# Halvy — Project Instructions

## Identity
Halvy: chat-first social expense-splitting app for Gen Z.
"A chat app with financial intelligence, not a finance app with chat."

## Stack
Expo (React Native) · Expo Router · Supabase · NativeWind · Zustand · Gemini API
Testing: Jest + React Native Testing Library + Detox (E2E)

## Commands
npm run start          # Expo dev server
npm run test           # Jest
npm run test:e2e       # Detox E2E
npm run lint           # ESLint + Prettier
npm run typecheck      # TypeScript strict

## Architecture
- Feature-based: src/features/{name}/ with components/, hooks/, utils/, types/, __tests__/
- Shared code: src/shared/ (ui/, hooks/, utils/, types/)
- Max file: 300 lines. Split at 200.
- Functional components + hooks only. No class components.
- Supabase RLS mandatory on all tables.
- Zod for runtime validation at boundaries.

## Code Style
- TypeScript strict. No `any`.
- `const` over `let`. No `var`.
- Named exports only (except screen defaults).
- Error boundaries on every screen.

## Git
- Commit: `<type>(scope): <description>`
- Branch: `<type>/<spec-id>-<short-description>`
- PR references spec: "Implements SPEC-NNN"

## Spec-Driven Development
Every feature requires an approved spec in docs/specs/ before code.
Specs follow docs/specs/_TEMPLATE.md format.
Post-dev: spec-verifier agent checks implementation vs spec.

## Key Docs (read on-demand, not always loaded)
- Product vision: docs/prd/
- Schema: docs/schema/
- API contracts: docs/api/
- Design system: docs/design-system/
- Phase roadmap: docs/phases/
- Feature specs: docs/specs/
```

That's ~60 lines. Lean, scannable, and under the instruction budget.

---

## 4. CLAUDE.md — Lean Context with @imports

**v2 principle:** CLAUDE.md is a routing layer, not a knowledge dump. It references `@AGENTS.md` for universal rules and uses `@imports` to pull in deep context only when needed. This keeps the active context window lean while providing deep links.

```markdown
# Halvy — Claude Code Configuration

See @AGENTS.md for universal project rules.

## Deep Context (loaded on-demand via @imports)
- Product requirements: @docs/prd/README.md
- Database schema: @docs/schema/README.md
- API contracts: @docs/api/README.md
- Design system: @docs/design-system/README.md
- Phase roadmap: @docs/phases/README.md
- Spec registry: @docs/specs/_INDEX.md
- Spec template: @docs/specs/_TEMPLATE.md

## Spec-Driven Workflow
1. `Use the product-owner agent to brainstorm feature X`
2. PO Agent produces spec → feasibility check → developer approves
3. `/plan "Implement SPEC-NNN"`
4. `/tdd` → implement → `/code-review` → `/security-scan`
5. `Use the spec-verifier agent on SPEC-NNN`

## Agent Teams (for parallel feature work)
Enable: CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
Pattern: spawn teammates per-spec on separate git worktrees.
Each teammate gets its own branch: feat/SPEC-{NNN}-slug

## Agents Available
- `product-owner` — Feature brainstorming, feasibility check, spec production
- `spec-verifier` — Post-dev implementation vs spec verification
- (ECC plugin: planner, architect, tdd-guide, code-reviewer,
  security-reviewer, build-error-resolver, e2e-runner)

## Skills Available
- `po-agent` — Product Owner workflow
- `spec-verifier` — Verification workflow
- `expo-mobile` — Expo/React Native patterns
- `halvy-context` — Project context loader

## MCP Servers
- Google Drive: for accessing PRD updates and shared docs
- Supabase: for querying schema and RLS policies directly
- (Optional) Figma: for design reference during UI specs
```

**Why @imports work:** Claude Code supports up to 5 hops of recursive imports. When an agent reads `@docs/schema/README.md`, it loads just that section into context — not the entire docs/ tree. This means a PO Agent brainstorming a chat feature loads the schema docs but not the design system docs, keeping its context window focused.

---

## 5. Product Owner Agent (v2 — with Feasibility Guardrail)

### 5.1 Agent Definition

File: `.claude/agents/product-owner.md`

```markdown
---
name: product-owner
description: >
  Product Owner agent for spec-driven development. Brainstorms features,
  runs technical feasibility checks, produces detailed specs with
  acceptance criteria. Full read access to codebase and docs.
tools:
  - Read
  - Glob
  - Grep
  - WebSearch
  - mcp__google-drive
  - mcp__supabase
model: opus
memory: project
---

You are the Product Owner for Halvy, a chat-first social expense-splitting
app targeting Gen Z users built on Expo, Supabase, NativeWind, and Gemini API.

## Your Role

You work directly with the developer (Ahmed) to:
1. Brainstorm and explore feature ideas
2. Challenge assumptions and identify edge cases
3. Run a Technical Feasibility Check before finalizing
4. Produce feature specs that development agents can execute

## Context Loading

Before any discussion, ground yourself in the following docs. These are
the eight canonical Layer 1 sources that constitute your product brain —
they are loaded into this Claude.ai Project's knowledge base and you
should treat them as authoritative.

### Layer 1 — Static Product Brain (always available in Project Knowledge)

**1. PRD** — the constitution. Test every feature idea against "chat app
with financial intelligence, not a finance app with chat." Reference the
full problem statement, target audience, core capabilities (A–H), cold
start strategy, and the explicit out-of-scope list to push back on
feature creep.

**2. schema** — the structural boundary. Entity relationships, XOR
constraints (payer vs placeholder), RLS permission matrix, and
triggers/automation table. Defines what's physically possible in the
data layer — any feature you propose must be compatible with or require
a clearly justified migration.

**3. expense-logic** — the financial engine. Living balance model, split
types, proportional tax/tip, largest remainder rounding, debt graph
simplification, and the integer-cents-only rule. Non-negotiable. Any
feature touching money must be compatible with these mechanics.

**4. phasing-strategy** — the roadmap and dependency map. Phase-by-phase
feature list, exit criteria, and deliverable checklists. Use this to
place a new feature in the correct phase and identify its dependency
chain.

**5. screens-and-navigation** — the UI surface map. Navigation graph,
inner tab structure, component specs, and screen-by-screen data
dependency table. Use this to know where a feature lives in the app and
which interaction patterns already exist.

**6. api-contracts** — endpoint conventions, error shapes, rate limits,
pagination pattern. Verify that proposed endpoints don't conflict with
existing ones and follow established conventions.

**7. ai-integration** — Gemini proxy architecture, OCR/voice pipelines,
rate limiting tiers, and the server-side-only rule for API key handling.
Any feature touching AI must work within these constraints.

**8. design-system** — tokens, component specs, animation guidelines.
Reference existing components (BalancePill, ExpenseCard, ChatInput)
when speccing UI rather than inventing from scratch.

### Layer 2 — Live Progress Monitor (from PO-CONTEXT.md)

At session start, also read `docs/PO-CONTEXT.md` (auto-generated from
repo by `scripts/generate-po-context.js`). This gives you:
- Spec registry: all SPEC-NNN entries with current status and feasibility
- Verification report summaries: PASS/FAIL/PARTIAL verdicts + any
  outstanding FAIL/PARTIAL items from the spec-verifier
- Phase completion: `- [x]` vs `- [ ]` count per phase

If PO-CONTEXT.md is not present, ask the developer to run
`node scripts/generate-po-context.js` and paste or upload the output.

### What is NOT in your context (and why)

- **env-and-config** — EAS secrets, `.env` structure, build profiles.
  Purely an execution concern; you never need to know where keys live.
- **project-structure** — File paths, directory conventions, import
  aliases, provider stack order. Defines *how code is organized*, not
  what features exist. Builder-only.
- **testing-strategy** — Jest config, Maestro flows, mocking patterns.
  You need test *results* (in PO-CONTEXT.md), not how tests are written.
- **migration-strategy** — SQL migration conventions, rollback patterns.
  Purely an execution concern.
- **auth-flow (standalone)** — Already captured at the product level in
  the PRD (Sections 4, 6.1) and schema (users table, group_invites,
  RLS). The standalone doc adds implementation detail you don't need.

## Brainstorming Mode

When exploring a feature idea:
- Ask clarifying questions about the user problem
- Propose multiple approaches with tradeoffs
- Reference existing Halvy architecture
- Consider impact on the chat-first paradigm
- Identify dependencies on other features or specs
- Think about Gen Z user expectations
- Consider Islamic finance principles where relevant

Be opinionated. Push back on feature creep. Advocate for the simplest
version that validates the hypothesis. Respect Ahmed's methodical,
approval-gated working style — never skip ahead without confirmation.

## ★ Technical Feasibility Check (MANDATORY before approval)

A spec CANNOT be marked as 🟢 approved until this check passes.
Run this automatically after the developer says "finalize" or "approve":

### Check 1: Schema Compatibility
- Read @docs/schema/ and compare against proposed data model
- Verify new tables don't conflict with existing ones
- Verify RLS policies are feasible with current auth model
- Flag any migration risks

### Check 2: API Compatibility
- Read @docs/api/ and check for endpoint conflicts
- Verify proposed endpoints follow existing conventions
- Check that request/response shapes are consistent

### Check 3: Dependency Verification
- For each spec listed in "Dependencies", verify it exists and its status
- Flag any circular dependencies
- Flag any dependencies on specs not yet approved

### Check 4: Phase Alignment
- Verify the feature belongs in the assigned phase
- Check that all prerequisite phases are complete or in-progress

### Feasibility Report Format:
```
## Feasibility Check: SPEC-NNN

| Check | Status | Notes |
|-------|--------|-------|
| Schema Compatibility | ✅ PASS / ❌ FAIL | ... |
| API Compatibility | ✅ PASS / ❌ FAIL | ... |
| Dependency Verification | ✅ PASS / ❌ FAIL | ... |
| Phase Alignment | ✅ PASS / ❌ FAIL | ... |

**Verdict:** FEASIBLE / NOT FEASIBLE
**Blockers:** [list if any]
```

If NOT FEASIBLE: Present blockers to developer. Iterate on spec until
all checks pass. Only then can status move to 🟢 approved.

## Spec Production Mode

When the developer says "let's write the spec":
1. Confirm scope from brainstorming
2. Draft spec following @docs/specs/_TEMPLATE.md
3. Present section by section for review
4. Iterate on feedback
5. Run Technical Feasibility Check ← MANDATORY
6. If feasible: save to docs/specs/{phase}/SPEC-{NNN}-{slug}.md
7. Update docs/specs/_INDEX.md

## Communication Style
- Direct and structured
- Concrete examples over abstractions
- Clear "Option A vs Option B" format for alternatives
- Tie decisions to: "chat app with financial intelligence"
```

### 5.2 PO Agent Skill (Cross-Platform)

File: `.agent-skills/po-agent/SKILL.md`

**v2 note:** Skill descriptions are under 50 words to follow Progressive Disclosure — agents see only the description until triggered, then load the full instructions.

```markdown
---
name: po-agent
description: >
  Product Owner workflow: brainstorm features, run feasibility checks,
  write detailed specs. Triggers: "brainstorm", "feature idea",
  "write spec", "PO mode", "requirements".
---

# Product Owner Workflow

## When to Use
- Starting work on a new feature or user story
- Exploring a feature idea before implementation
- Writing or updating a feature spec
- Making product decisions affecting multiple features

## Workflow

### Phase 1: Context Loading
1. Read docs/prd/ for product vision
2. Read docs/specs/_INDEX.md for existing specs
3. Read docs/phases/ for current phase priorities
4. Scan relevant src/ areas for implementation state

### Phase 2: Brainstorming (interactive)
1. Understand the user problem
2. Explore multiple approaches with tradeoffs
3. Identify dependencies and edge cases
4. Converge on a solution → get explicit approval

### Phase 3: Spec Writing
1. Use docs/specs/_TEMPLATE.md format
2. Fill each section with specifics
3. Acceptance criteria must be binary (pass/fail)
4. Reference design system, schema, API docs
5. Assign spec ID: SPEC-{NNN} (check _INDEX.md)

### Phase 4: Technical Feasibility Check ← MANDATORY
Before marking any spec as approved:
1. Check schema compatibility (docs/schema/)
2. Check API compatibility (docs/api/)
3. Verify all dependencies exist and are in valid state
4. Verify phase alignment
5. Produce feasibility report
6. If NOT FEASIBLE → iterate until all checks pass

### Phase 5: Finalize
1. Save to docs/specs/{phase}/SPEC-{NNN}-{slug}.md
2. Update docs/specs/_INDEX.md
3. Spec is ready for handoff to development agents
```

---

## 5.3 PO-CONTEXT Generator (Expanded for Layer 2)

File: `scripts/generate-po-context.js`

This script is the bridge between the live repo state and the PO Agent
in Claude.ai. It produces `docs/PO-CONTEXT.md`, which the PO Agent reads
at session start to understand current implementation progress.

```javascript
#!/usr/bin/env node
// scripts/generate-po-context.js
// Generates docs/PO-CONTEXT.md from three live repo sources:
//   1. docs/specs/_INDEX.md       → spec registry + status
//   2. docs/specs/**/*.report.md  → spec-verifier output
//   3. docs/phases/phasing-strategy.md → phase completion %

const fs   = require('fs');
const path = require('path');

const ROOT    = path.resolve(__dirname, '..');
const OUTPUT  = path.join(ROOT, 'docs', 'PO-CONTEXT.md');
const INDEX   = path.join(ROOT, 'docs', 'specs', '_INDEX.md');
const PHASES  = path.join(ROOT, 'docs', 'phases', 'phasing-strategy.md');
const REPORTS = path.join(ROOT, 'docs', 'specs');

// ── 1. Spec Registry ────────────────────────────────────────────────
function extractSpecIndex() {
  if (!fs.existsSync(INDEX)) return '> `docs/specs/_INDEX.md` not found.\n';
  const lines = fs.readFileSync(INDEX, 'utf8').split('\n');
  // Keep phase headers, table headers, dividers, and data rows.
  // Strip commentary prose that doesn't belong in a snapshot.
  return lines
    .filter(l => /^(#|##|\|)/.test(l.trim()))
    .join('\n');
}

// ── 2. Verification Reports ──────────────────────────────────────────
function extractVerificationSummaries() {
  const reports = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.report.md')) reports.push(full);
    }
  }
  if (fs.existsSync(REPORTS)) walk(REPORTS);
  if (!reports.length) return '> No verification reports found yet.\n';

  return reports.map(f => {
    const content = fs.readFileSync(f, 'utf8');
    // Extract: spec ID, verdict line, and any FAIL/PARTIAL rows
    const specId  = content.match(/SPEC-(\d+)/)?.[0] ?? path.basename(f);
    const verdict = content.match(/\*\*Verdict:\*\*\s*(.+)/)?.[1] ?? 'unknown';
    const issues  = (content.match(/\|\s*(FAIL|PARTIAL)\s*\|.+/g) ?? [])
                      .map(l => '  - ' + l.trim()).join('\n');
    return `### ${specId}\n**Verdict:** ${verdict}\n${issues || '  *(no open issues)*'}`;
  }).join('\n\n');
}

// ── 3. Phase Completion ──────────────────────────────────────────────
function extractPhaseCompletion() {
  if (!fs.existsSync(PHASES)) return '> `phasing-strategy.md` not found.\n';
  const text   = fs.readFileSync(PHASES, 'utf8');
  const phases = text.split(/^## Phase \d/m).slice(1);
  const phaseHeaders = [...text.matchAll(/^## (Phase \d[^\n]*)/gm)].map(m => m[1]);

  return phaseHeaders.map((header, i) => {
    const block  = phases[i] ?? '';
    const done   = (block.match(/- \[x\]/gi) ?? []).length;
    const total  = (block.match(/- \[(x| )\]/gi) ?? []).length;
    const pct    = total ? Math.round((done / total) * 100) : 0;
    return `| ${header} | ${done}/${total} | ${pct}% |`;
  }).join('\n');
}

// ── Assemble ─────────────────────────────────────────────────────────
const now = new Date().toISOString().slice(0, 16).replace('T', ' ');

const output = `# PO-CONTEXT — Halvy Live Progress Snapshot
_Generated: ${now} UTC — do not edit manually_

---

## 1. Spec Registry

${extractSpecIndex()}

---

## 2. Verification Report Summaries

${extractVerificationSummaries()}

---

## 3. Phase Completion

| Phase | Deliverables | Completion |
|-------|-------------|------------|
${extractPhaseCompletion()}

---
_End of snapshot. Paste or upload this file at the start of a PO Agent session._
`;

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, output);
console.log(`✓ PO-CONTEXT.md written to ${path.relative(ROOT, OUTPUT)}`);
```

The GitHub Action `po-context-sync.yml` triggers this script on:
- Manual dispatch
- Pushes to `main` that touch any of: `docs/specs/`, `docs/phases/`, `docs/prd/`
- Weekly schedule (Monday 08:00 UTC)

---

### 6.1 Spec Template

File: `docs/specs/_TEMPLATE.md`

```markdown
---
id: SPEC-NNN
title: "Feature Title"
phase: 0
status: draft | review | feasibility-check | approved | in-progress | completed | verified
priority: P0 | P1 | P2
complexity: S | M | L | XL
created: YYYY-MM-DD
updated: YYYY-MM-DD
depends-on: [SPEC-NNN, SPEC-NNN]
branch: feat/SPEC-NNN-slug
feasibility: pending | pass | fail
---

# SPEC-NNN: Feature Title

## 1. Overview

**Problem:** What user problem does this solve?

**Solution:** One-paragraph description of the approach.

**Fits the vision because:** How this connects to "chat app with
financial intelligence."

## 2. User Stories

- As a [user type], I want to [action], so that [benefit].

## 3. Acceptance Criteria

Each criterion MUST be binary (pass/fail) and testable.

- [ ] AC-1: [Specific, measurable criterion]
- [ ] AC-2: [Specific, measurable criterion]
- [ ] AC-3: [Specific, measurable criterion]

## 4. Data Model

### New Tables
```sql
CREATE TABLE table_name (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
CREATE POLICY "policy_name" ON table_name
  FOR SELECT USING (auth.uid() = user_id);
```

### Modified Tables
- `table_name`: Add column `column_name` (type) — reason

## 5. API Contracts

### Endpoint Name
```
POST /api/endpoint
Authorization: Bearer {token}

Request:  { "field": "type — description" }
Response: { "field": "type — description" }
Errors:   400 validation_error | 401 unauthorized | 404 not_found
```

## 6. UI/UX Specifications

### Screen: Screen Name
- Layout, components, NativeWind classes
- Interactions (tap, swipe, long-press)
- Loading / empty / error states

### Navigation Flow
```
Screen A → (action) → Screen B → (error) → Error Modal
```

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

- Frontend / Backend / Testing: S/M/L each
- Total: S/M/L/XL

## 11. Testing Strategy

- Unit / Integration / E2E test targets

## 12. Feasibility Check Results

```
| Check | Status | Notes |
|-------|--------|-------|
| Schema Compatibility | ✅/❌ | ... |
| API Compatibility | ✅/❌ | ... |
| Dependency Verification | ✅/❌ | ... |
| Phase Alignment | ✅/❌ | ... |
Verdict: FEASIBLE / NOT FEASIBLE
```

## 13. Open Questions

- [ ] [Unresolved questions before dev starts]
```

### 6.2 Spec Index

File: `docs/specs/_INDEX.md`

```markdown
# Halvy Feature Specs — Registry

## Status Legend
- 🔵 `draft` — Being written by PO Agent
- 🟡 `review` — Awaiting developer approval
- 🔍 `feasibility-check` — Running technical feasibility ← NEW
- 🟢 `approved` — Feasibility passed, ready for dev
- 🔶 `in-progress` — Currently being developed
- ✅ `completed` — Dev done, awaiting verification
- ✔️ `verified` — Spec verifier confirmed match

## Phase 0: Foundation

| ID | Title | Status | Priority | Complexity | Feasibility | Branch |
|----|-------|--------|----------|------------|-------------|--------|
| SPEC-001 | Auth Flow | 🟢 | P0 | M | ✅ pass | feat/SPEC-001-auth |
| SPEC-002 | Chat Core | 🔵 | P0 | L | pending | — |
```

---

## 7. Spec Verifier Agent

File: `.claude/agents/spec-verifier.md`

```markdown
---
name: spec-verifier
description: >
  Verifies completed feature implementation matches its spec.
  Compares acceptance criteria, data model, API contracts, and UI
  against actual code. Read-only — never modifies code.
tools:
  - Read
  - Glob
  - Grep
  - Bash(read-only)
model: sonnet
---

You are a spec verification agent for Halvy. Compare a feature's
implementation against its approved spec and produce a verification report.

## Process

### Step 1: Load Spec
Read docs/specs/{phase}/SPEC-{NNN}-{slug}.md.
Parse all acceptance criteria, data model, API contracts, UI specs.

### Step 2: Trace Implementation

**Acceptance Criteria:**
- For each AC, find implementing code AND verifying test
- Mark: PASS (code + test), PARTIAL (code, no test), FAIL (missing)

**Data Model:**
- Compare spec SQL vs actual Supabase migrations
- Verify RLS policies match

**API Contracts:**
- Find Edge Functions / API routes
- Compare request/response shapes
- Verify error handling

**UI/UX:**
- Find screen/component files
- Verify navigation flow, design tokens, loading/empty/error states

**Edge Cases:**
- For each edge case, find handling code and test coverage

### Step 3: Report

```
## Verification Report: SPEC-{NNN}

### Summary
- Verdict: PASS | FAIL | PARTIAL
- Coverage: X/Y acceptance criteria passing

### Acceptance Criteria
| AC | Description | Status | Evidence |
|----|-------------|--------|----------|
| AC-1 | ... | ✅/❌/⚠️ | file:line |

### Data Model / API / UI / Edge Cases
[findings per section]

### Recommended Actions
1. [specific fix]
2. [missing test]
```

Update spec status in _INDEX.md based on verdict.
```

---

## 8. ECC Integration — Development Pipeline

### 8.1 Installing ECC

```bash
# Clone ECC
git clone https://github.com/affaan-m/everything-claude-code.git

# Copy rules (TypeScript for React Native)
mkdir -p .claude/rules
cp -r everything-claude-code/rules/common .claude/rules/
cp -r everything-claude-code/rules/typescript .claude/rules/

# Install as Claude Code plugin
/plugin marketplace add affaan-m/everything-claude-code
/plugin install everything-claude-code@everything-claude-code

# Generate Codex compatibility
/codex-setup

# Install Codex cross-review plugin
/plugin marketplace add openai/codex-plugin-cc
/plugin install codex@openai-codex
/codex:setup
```

### 8.2 The Spec-to-Dev Pipeline

```
┌───────────────────────────────────────────────────┐
│  SPEC APPROVED (feasibility ✅)                    │
│  docs/specs/phase-N/SPEC-NNN.md                   │
└──────────────────┬────────────────────────────────┘
                   │
                   ▼
┌───────────────────────────────────────────────────┐
│  1. PLAN                                           │
│  /plan "Implement SPEC-NNN"                        │
│  Agent: planner reads spec + codebase              │
│  Gate: Developer approves plan                     │
└──────────────────┬────────────────────────────────┘
                   │
                   ▼
┌───────────────────────────────────────────────────┐
│  2. TDD                                            │
│  /tdd                                              │
│  Write failing tests from acceptance criteria      │
│  Implement → tests pass → refactor                 │
│  Target: 80%+ coverage                             │
└──────────────────┬────────────────────────────────┘
                   │
                   ▼
┌───────────────────────────────────────────────────┐
│  3. CODE REVIEW + SECURITY                         │
│  /code-review → /security-scan                     │
│  Gate: All CRITICAL/HIGH resolved                  │
└──────────────────┬────────────────────────────────┘
                   │
                   ▼
┌───────────────────────────────────────────────────┐
│  4. CROSS-AGENT REVIEW (optional)                  │
│  /codex:review or /codex:adversarial-review        │
│  Second opinion from a different model              │
└──────────────────┬────────────────────────────────┘
                   │
                   ▼
┌───────────────────────────────────────────────────┐
│  5. SPEC VERIFICATION                              │
│  Agent: spec-verifier                              │
│  Compare implementation vs spec                    │
│  Gate: FAIL → loop to step 2                       │
│         PASS → update status to ✔️ verified         │
└───────────────────────────────────────────────────┘
```

### 8.3 ★ Parallel Execution with Agent Teams + Worktrees

**v2 upgrade:** Use Claude Code Agent Teams (launched Feb 2026) and git worktrees for safe parallel work across specs. This prevents agents from overwriting each other's Zustand stores, Supabase types, or navigation stacks.

#### Setup

```bash
# Enable Agent Teams
# In ~/.claude/settings.json:
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

#### Pattern 1: Agent Teams (Claude Code native)

For 2–4 independent specs in the same phase:

```
claude > Create an agent team for Phase 1 implementation.
         Spawn teammates:
         - Teammate 1: Implement SPEC-003 (group invitations)
           Read docs/specs/phase-1/SPEC-003-group-invitations.md
         - Teammate 2: Implement SPEC-004 (message reactions)
           Read docs/specs/phase-1/SPEC-004-message-reactions.md
         - Teammate 3: Write E2E tests for SPEC-001 and SPEC-002
           Read the acceptance criteria from both specs
         Each teammate works on its own branch: feat/SPEC-{NNN}-slug
         Coordinate through the shared task list.
```

Each teammate gets:
- Its own context window (up to 1M tokens with Opus 4.6)
- Automatic loading of CLAUDE.md, skills, and MCP servers
- Peer-to-peer messaging for coordination

#### Pattern 2: Git Worktrees + Multi-Tool Parallelization

For using Claude Code, Antigravity, and Codex simultaneously:

```bash
# Create isolated worktrees per spec
git worktree add ../halvy-spec-003 feat/SPEC-003-group-invitations
git worktree add ../halvy-spec-004 feat/SPEC-004-message-reactions
git worktree add ../halvy-spec-005 feat/SPEC-005-expense-create
```

Then run different agents in each:

```
# Terminal 1: Claude Code on SPEC-003
cd ../halvy-spec-003 && claude

# Terminal 2: Codex on SPEC-004
cd ../halvy-spec-004 && codex

# Antigravity: Open ../halvy-spec-005 as workspace
# Assign Agent A to implement the feature
```

#### Parallelization Safety Rules

1. **Only parallelize specs with NO shared dependencies** — check the Dependencies section of each spec
2. **Each agent works on a separate git branch** via worktree
3. **Merge order follows dependency order** — never merge a dependent before its prerequisite
4. **Run spec-verifier AFTER merge** to catch integration issues
5. **Never parallelize specs that touch the same Zustand store, Supabase table, or navigation stack** — these create merge conflicts that agents handle poorly

---

## 9. Expo/React Native Skill

File: `.agent-skills/expo-mobile/SKILL.md`

```markdown
---
name: expo-mobile
description: >
  Expo and React Native patterns for cross-platform mobile. Triggers:
  "component", "screen", "navigation", "expo", "NativeWind", "mobile".
---

# Expo / React Native Development Skill

## Project Assumptions
- Expo SDK managed workflow with Expo Router
- NativeWind styling (Tailwind CSS syntax)
- Supabase backend
- TypeScript strict mode

## Feature File Structure
```
src/features/{name}/
├── components/
│   ├── Component.tsx
│   └── Component.test.tsx
├── hooks/
│   ├── useFeatureData.ts
│   └── useFeatureData.test.ts
├── utils/
├── types/           # Zod schemas + TS types
├── __tests__/       # Integration tests
└── index.ts         # Named exports only
```

## Component Patterns

### Screen
```typescript
import { ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';

export default function FeatureScreen() {
  return (
    <ErrorBoundary>
      <Stack.Screen options={{ title: 'Feature' }} />
      <ScrollView className="flex-1 bg-background">
        {/* content */}
      </ScrollView>
    </ErrorBoundary>
  );
}
```

### Reusable Component
```typescript
import { View, Text, Pressable } from 'react-native';

export function Card({ title, onPress }: CardProps) {
  return (
    <Pressable
      className="p-4 bg-card rounded-2xl active:opacity-70"
      onPress={onPress}
    >
      <Text className="text-base font-medium text-foreground">{title}</Text>
    </Pressable>
  );
}
```

## NativeWind Rules
- `className` with Tailwind utilities
- Platform: `className="ios:pt-2 android:pt-4"`
- Dark mode: `className="bg-white dark:bg-gray-900"`
- Never mix StyleSheet.create and className
- Use design tokens from tailwind.config.ts

## Supabase Realtime (Chat Pattern)
```typescript
useEffect(() => {
  const channel = supabase
    .channel(`chat:${groupId}`)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public',
      table: 'messages', filter: `group_id=eq.${groupId}`,
    }, handleNewMessage)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, [groupId]);
```

## Common Pitfalls
1. No `window`/`document` — not available in RN
2. No `<div>/<span>/<p>` — use RN primitives
3. Always handle keyboard avoidance on inputs
4. Always handle safe area insets
5. Always handle deep linking for navigable screens
6. Use `expo-image` over `Image` for performance
7. Use `FlashList` over `FlatList` for long lists
8. Test on BOTH iOS and Android — no visual parity assumptions
```

---

## 10. Halvy Context Loader Skill

File: `.agent-skills/halvy-context/SKILL.md`

```markdown
---
name: halvy-context
description: >
  Loads Halvy project context from docs/. Use before significant
  dev tasks. Triggers: "load context", "project context", any
  reference to specs, schema, or architecture.
---

# Halvy Context Loader

## Loading Tiers

### Tier 1: Always (for any task)
1. AGENTS.md
2. docs/specs/_INDEX.md

### Tier 2: Feature-specific (load when relevant)
3. docs/prd/ — when discussing product direction
4. docs/schema/ — when touching data layer
5. docs/api/ — when touching endpoints
6. docs/design-system/ — when touching UI
7. docs/ai-integration/ — when touching Gemini features

### Tier 3: Implementation (load when coding)
8. src/shared/ — shared utilities, hooks, types
9. Specific src/features/{name}/ for the feature being worked on

## Usage
Tell any agent: "Load Halvy context for [area]"
- "for chat features" → Tier 1 + schema + existing chat code
- "for expense engine" → Tier 1 + schema + API + AI integration
- "for full overview" → Tier 1 + Tier 2 (no code)
```

---

## 11. MCP Integration for Smarter PO Agent

**v2 addition:** Connect the PO Agent to external tools via MCP so it can access real-time context without manual pasting.

### Google Drive MCP
Allows the PO Agent to read updated PRDs, meeting notes, or competitor research you've saved to Drive.

```json
// .claude/mcp-configs/google-drive.json
{
  "mcpServers": {
    "google-drive": {
      "type": "url",
      "url": "https://mcp.google-drive.com/sse",
      "description": "Read PRD updates and shared docs from Google Drive"
    }
  }
}
```

### Supabase MCP
Allows agents to query the actual database schema and RLS policies directly, rather than relying on potentially outdated docs.

```json
// .claude/mcp-configs/supabase.json
{
  "mcpServers": {
    "supabase": {
      "type": "url",
      "url": "https://mcp.supabase.com/sse",
      "description": "Query Halvy database schema, RLS policies, and edge functions"
    }
  }
}
```

### Figma MCP (Optional)
If you use Figma for design, the PO Agent can reference actual designs during UI spec writing.

```json
// .claude/mcp-configs/figma.json
{
  "mcpServers": {
    "figma": {
      "type": "url",
      "url": "https://mcp.figma.com/sse",
      "description": "Reference Halvy design files for UI specs"
    }
  }
}
```

**Usage in PO Agent brainstorming:**
```
claude > Use the product-owner agent to brainstorm the receipt
         scanning feature. Check Google Drive for the latest
         competitive analysis doc, and query Supabase for the
         current expenses table schema.
```

---

## 12. Codex & Antigravity Configuration

### Codex CLI

File: `.codex/config.toml`

```toml
# Halvy — Codex CLI Configuration
project_doc_fallback_filenames = ["CLAUDE.md"]
```

### Antigravity

File: `GEMINI.md`

```markdown
# Halvy — Antigravity Overrides

Use Gemini 3 Pro for implementation. Claude Opus 4.6 for architecture.
Skills in .agent/skills/ (symlinked from .agent-skills/).
Follow pipeline defined in AGENTS.md.
```

---

## 13. PO Agent in Different Environments

### Claude Code (Terminal) — Richest experience
```
claude > Use the product-owner agent to brainstorm the group
         invitation feature for Phase 1
```
PO agent loads docs via @imports, runs feasibility check, outputs spec.

### Claude.ai (This Chat) — Project Knowledge + PO-CONTEXT Bridge

The PO Agent lives in a **dedicated Claude.ai Project** with 8 static
docs loaded as Project Knowledge (Layer 1). It cannot read files from
the repo directly. The bridge is `docs/PO-CONTEXT.md`.

#### Layer 1: Project Knowledge (static, upload once, update on spec doc revisions)

Upload these 8 files directly to the Claude.ai Project's knowledge base:

| # | File | Why it's here |
|---|------|---------------|
| 1 | PRD | Product constitution, out-of-scope list |
| 2 | schema | Data model, RLS constraints |
| 3 | expense-logic | Financial engine rules |
| 4 | phasing-strategy | Roadmap + exit criteria |
| 5 | screens-and-navigation | UI surface map |
| 6 | api-contracts | Endpoint conventions |
| 7 | ai-integration | Gemini proxy architecture |
| 8 | design-system | Component vocabulary |

Also upload: `docs/specs/_TEMPLATE.md` and this system design doc.

#### Layer 2: PO-CONTEXT.md (live progress — regenerate per session)

The `generate-po-context.js` script produces `docs/PO-CONTEXT.md`.
Paste or upload it at the start of each PO brainstorming session.

**What it contains:**
1. **Spec registry** — all SPEC-NNN entries from `_INDEX.md` with
   current status, feasibility verdict, and branch names
2. **Verification summaries** — PASS/FAIL/PARTIAL verdict per completed
   spec, plus any unresolved FAIL/PARTIAL acceptance criteria
3. **Phase completion %** — count of `- [x]` vs `- [ ]` items per phase
   from phasing-strategy deliverable checklists
4. **Test coverage summary** — extracted from `jest --coverage` output

**Trigger:** GitHub Action (`po-context-sync.yml`) runs on manual
trigger, core doc changes pushed to main, and weekly Monday schedule.
Can also be run manually: `node scripts/generate-po-context.js`

#### System Prompt for PO Agent (Claude.ai)

```
You are the Product Owner for Halvy, a chat-first social expense-
splitting app for Gen Z. Your product brain is in this Project's
knowledge base (PRD, schema, expense-logic, phasing-strategy,
screens-and-navigation, api-contracts, ai-integration, design-system).

Follow the spec template format. Run a Technical Feasibility Check
before finalizing any spec. Never skip the feasibility gate.

At session start, read the attached PO-CONTEXT.md for current spec
registry, verification status, and phase completion.
```

### Antigravity (Agent Manager)
```
Read .agent/skills/po-agent/SKILL.md and follow its workflow.
Brainstorm and produce a spec for [feature].
Read docs/ for context. Save output to docs/specs/{phase}/.
```

---

## 14. Quick Start Checklist

### One-Time Setup

```bash
# 1. Clone and install ECC rules
git clone https://github.com/affaan-m/everything-claude-code.git
mkdir -p .claude/rules
cp -r everything-claude-code/rules/common .claude/rules/
cp -r everything-claude-code/rules/typescript .claude/rules/

# 2. Install plugins in Claude Code
/plugin marketplace add affaan-m/everything-claude-code
/plugin install everything-claude-code@everything-claude-code
/plugin marketplace add openai/codex-plugin-cc
/plugin install codex@openai-codex
/codex:setup

# 3. Create skills directory + symlinks
mkdir -p .agent-skills/{po-agent,spec-verifier,expo-mobile,halvy-context}
mkdir -p .claude .agent
ln -sfn ../.agent-skills .claude/skills
ln -sfn ../.agent-skills .agent/skills

# 4. Create agent definitions
mkdir -p .claude/agents
# Copy product-owner.md and spec-verifier.md from this doc

# 5. Create spec infrastructure
mkdir -p docs/specs/{phase-0,phase-1,phase-2,phase-3}
# Copy _TEMPLATE.md and _INDEX.md from this doc

# 6. Create config files
# Copy AGENTS.md, CLAUDE.md, GEMINI.md, .codex/config.toml

# 7. Enable Agent Teams
# Add to ~/.claude/settings.json:
# "env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" }

# 8. Commit
git add .agent-skills/ .claude/ .agent/ .codex/ docs/specs/ \
       AGENTS.md CLAUDE.md GEMINI.md
git commit -m "chore: add ECC multi-agent config with PO Agent v2"
```

### Per-Feature Workflow

1. **Brainstorm** — PO Agent in any environment
2. **Draft spec** — PO produces spec → you review → [Gate 1]
3. **Feasibility check** — PO runs technical feasibility ← NEW
4. **Finalize** — Iterate until feasible → approve → [Gate 2]
5. **Plan** — `/plan "Implement SPEC-NNN"`
6. **Develop** — `/tdd` → implement → test
7. **Review** — `/code-review` → `/security-scan` → `/codex:review`
8. **Verify** — spec-verifier agent → [Gate 3]
9. **Ship** — Merge, update spec status to ✔️

---

## 15. Artifacts Summary

| File | Purpose |
|------|---------|
| `AGENTS.md` | Universal brief (<150 lines) for all tools |
| `CLAUDE.md` | Lean routing with @imports |
| `GEMINI.md` | Antigravity overrides |
| `.codex/config.toml` | Codex CLI config |
| `.agent-skills/po-agent/SKILL.md` | PO skill (cross-platform) |
| `.agent-skills/spec-verifier/SKILL.md` | Verification skill |
| `.agent-skills/expo-mobile/SKILL.md` | Expo/RN development skill |
| `.agent-skills/halvy-context/SKILL.md` | Context loader skill |
| `.claude/agents/product-owner.md` | PO subagent (with feasibility check + Layer 1/2 context) |
| `.claude/agents/spec-verifier.md` | Spec verifier subagent |
| `.claude/skills` | Symlink → `.agent-skills/` |
| `.agent/skills` | Symlink → `.agent-skills/` |
| `docs/specs/_TEMPLATE.md` | Spec template (with feasibility section) |
| `docs/specs/_INDEX.md` | Spec registry with feasibility column |
| `docs/PO-CONTEXT.md` | ★ Auto-generated Layer 2 snapshot (spec status + verification + phase %) |
| `scripts/generate-po-context.js` | ★ Generates PO-CONTEXT.md from live repo sources |
| `.github/workflows/po-context-sync.yml` | ★ Triggers generator on push/schedule/manual |
| `scripts/setup-skill-links.sh` | One-time symlink setup |
