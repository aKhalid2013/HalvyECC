# Halvy — Antigravity Configuration

Read AGENTS.md for all universal project rules. That file is the source of truth.

Skills are in .agent/skills/ (symlinked from .agent-skills/).
Agent definitions for reference are in .claude/agents/.

Follow the same spec-driven workflow defined in AGENTS.md:
1. Every feature needs an approved spec in docs/specs/ before code
2. Post-dev: run spec-verifier workflow from .agent/skills/spec-verifier/SKILL.md
3. All monetary values in integer cents. No floats.
4. Gemini API calls via Supabase ai-proxy Edge Function only — never direct.
