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
2. Update docs/specs/_INDEX.md:
   - Find the appropriate table for the Phase.
   - Insert/update the row filling all columns: `| ID | Title | Status | Priority | Complexity | Feasibility | Branch | Assignee | Updated |`
   - Set `Status` to `🟢 approved`.
   - Set `Feasibility` to `✅ pass`.
   - Update `Updated` to today's date (YYYY-MM-DD).
3. Spec is ready for handoff to development agents
