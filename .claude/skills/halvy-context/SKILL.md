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
