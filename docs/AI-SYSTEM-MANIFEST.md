# AI Development System — Manifest

_Last updated: 2026-04-08_

## Purpose

This system orchestrates AI coding agents across Claude Code, Antigravity,
Codex CLI, and Gemini CLI to execute a spec-driven development workflow:
PO spec → TDD dev → Verify.

## File inventory

### Configuration (tool-specific entry points)

| File | Read by | Purpose |
|------|---------|---------|
| `AGENTS.md` | All tools | Universal project brief |
| `CLAUDE.md` | Claude Code | Routing layer with @imports |
| `GEMINI.md` | Antigravity / Gemini CLI | Overrides + points to AGENTS.md |
| `.codex/config.toml` | Codex CLI | Falls back to CLAUDE.md |

### Skills (cross-platform — `.agent-skills/`)

| Skill | Type | Purpose |
|-------|------|---------|
| `po-agent` | Workflow | PO brainstorm → feasibility → spec |
| `spec-verifier` | Workflow | Post-dev implementation vs spec check |
| `tdd-workflow` | Workflow | TDD loop enforcement |
| `halvy-context` | Project | Tiered doc loader |
| `halvy-expense-logic` | Project | Expense domain rules |
| `react-native-expo` | Stack | RN/Expo patterns |
| `expo-mobile` | Stack | Expo quick-reference |
| `mobile-e2e` | Stack | Detox + Maestro E2E |
| `postgres-patterns` | General | Supabase/PostgreSQL optimization |
| `api-design` | General | REST conventions |
| `database-migrations` | General | Safe schema changes |
| `security-review` | General | Security checklists |
| `security-scan` | General | AgentShield config audit |

### Agent definitions (Claude Code — `.claude/agents/`)

| Agent | Purpose |
|-------|---------|
| `product-owner.md` | Brainstorm, feasibility, spec writing |
| `spec-verifier.md` | Post-dev verification |

### Rules (Claude Code — `.claude/rules/`)

| Set | Source |
|-----|--------|
| `common/patterns.md` | ECC — language-agnostic |
| `typescript/patterns.md` | ECC — TypeScript-specific |

### Contexts (Claude Code — `.claude/contexts/`)

| Context | Mode |
|---------|------|
| `dev.md` | Active coding |
| `review.md` | PR review |
| `research.md` | Discovery |

### Feedback pipeline (NEW)

| File | Purpose |
|------|---------|
| `feedback-logs/sessions/*.json` | Per-session agent logs |
| `feedback-logs/verifications/*.json` | Spec verification results |
| `feedback-logs/observations/*.json` | Manual observations |
| `feedback-schemas/*.schema.json` | JSON schemas for validation |
| `scripts/generate-process-feedback.js` | Aggregates logs into digest |
| `.github/workflows/process-feedback-sync.yml` | CI trigger for aggregation |
| `docs/PROCESS-FEEDBACK.md` | Generated digest for Process Improvement Agent |

### Scripts & CI

| Script | Purpose |
|--------|---------|
| `scripts/generate-po-context.js` | Generates PO-CONTEXT.md |
| `scripts/generate-process-feedback.js` | Generates PROCESS-FEEDBACK.md |
| `scripts/setup-skill-links.sh` | One-time symlink setup |
| `.github/workflows/po-context-sync.yml` | PO context auto-sync |
| `.github/workflows/process-feedback-sync.yml` | Feedback digest auto-sync |

## Cross-platform compatibility

| Capability | Claude Code | Antigravity | Codex CLI | Gemini CLI |
|------------|-------------|-------------|-----------|------------|
| Reads AGENTS.md | via @import | Direct | Fallback | Direct |
| Tool-specific config | CLAUDE.md | GEMINI.md | .codex/config.toml | GEMINI.md |
| Skills | .claude/skills symlink | .agent/skills symlink | Via AGENTS.md | .agent/skills symlink |
| Subagents | .claude/agents/ | N/A | N/A | N/A |
| ECC commands | /plan /tdd /code-review | N/A | /codex:review | N/A |
