# Development Workflow

> This file extends common/git-workflow.md with the full feature
> development process that runs before git operations.

## Feature Implementation Workflow

### Step 0 — Research & Reuse (mandatory before any new implementation)

- GitHub code search first: run gh search code before writing anything new
- Library docs second: confirm API behavior before implementing
- Check package registries: prefer battle-tested libraries over hand-rolled
- Adopt or port a proven approach when it meets 80%+ of the requirement

### Step 1 — Plan First

⛔ THIS STEP ENDS WHEN THE PLAN IS WRITTEN. DO NOT CONTINUE TO STEP 2.

Run: /plan "Implement SPEC-NNN"

The planner agent will:
  1. Read the spec at docs/specs/{phase}/SPEC-NNN-{slug}.md
  2. Scan relevant src/ code
  3. Write docs/plans/SPEC-NNN-tasks.md (task list, one task per section)
  4. Print ✅ PLAN COMPLETE stop message
  5. HALT — no source code is written

After the agent halts, the developer must:
  - Open docs/plans/SPEC-NNN-tasks.md
  - Review every task entry
  - Check all boxes in the Approval Checklist
  - Only then run /tdd TASK-1 SPEC-NNN to begin

⛔ HUMAN GATE: No implementation starts until the developer explicitly
runs a /tdd command. The agent never bridges this gap on its own.

### Step 2 — TDD, One Task at a Time

⛔ EACH /tdd CALL IS ONE TASK. ONE SESSION. THEN STOP.

Run: /tdd TASK-N SPEC-NNN

The tdd-guide agent will:
  1. Read TASK-N from docs/plans/SPEC-NNN-tasks.md
  2. Read only the files listed in that task's "Files" section
  3. Write failing tests for that task's acceptance criteria (RED)
  4. Implement the minimum code to make tests pass (GREEN)
  5. Refactor — verify 80%+ coverage
  6. Mark TASK-N Status: ✅ done in the task list file
  7. Print: "TASK-N complete. Run /tdd TASK-N+1 SPEC-NNN to continue."
  8. HALT

Each task runs in its own session. A new Claude Code session starting
with /tdd TASK-N can implement that task with no memory of prior sessions
because each task has a self-contained Context block in the task list file.

To continue to the next task, the developer runs /tdd TASK-N+1 SPEC-NNN
in a new session. This is a deliberate human-in-the-loop checkpoint.

### Step 3 — Code Review + Security

Run after each task or after all tasks are complete:
  /code-review
  /security-scan

Gate: all CRITICAL and HIGH findings must be resolved before continuing.

### Step 4 — Commit and Push

One commit per completed task:
  feat(SPEC-NNN): implement TASK-N — [task title]

See git-workflow.md for full commit message format and PR process.

### Step 5 — Spec Verification

After all tasks in the spec are marked ✅ done:
  Use the spec-verifier agent on SPEC-NNN

The agent checks every acceptance criterion in the spec against the
implementation. FAIL or PARTIAL → loop back to the relevant task.
PASS → update spec status in docs/specs/_INDEX.md → merge → ship.

## Naming Reference

| Term | Used In | Never Confused With |
|------|---------|---------------------|
| TASK-N | docs/plans/ task lists | app release phases |
| Phase N (0–9) | docs/phases/ release strategy | implementation tasks |
| SPEC-NNN | docs/specs/ feature specs | tasks or phases |
