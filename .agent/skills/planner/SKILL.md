---
name: planner
description: >
  Implementation planning for a SPEC. Reads spec + codebase, produces a
  numbered task list file, then STOPS. Never writes source code.
  Triggers: "/plan", "plan SPEC-NNN", "create implementation plan".
origin: ECC + Halvy
---

# Planner Skill

## Critical Constraint — Read This First

This skill produces a PLAN DOCUMENT and then STOPS.
It does NOT write source code.
It does NOT create files in src/.
It does NOT run tests.
It does NOT proceed to implementation.
The session ENDS after the plan document is written and the stop message
is printed. This is not negotiable.

## When to Activate

- Developer runs /plan "Implement SPEC-NNN"
- Any request to plan implementation of a spec

## Required Inputs

- The spec file at: docs/specs/{phase-folder}/SPEC-NNN-{slug}.md
  If the spec file path is not known, search docs/specs/ for SPEC-NNN.
- Scan of relevant src/ directories to understand existing code

## Workflow

### Step 1 — Read the spec

Open the spec file. Extract:
- Title and SPEC ID
- Acceptance criteria (every binary pass/fail criterion)
- Dependencies on other specs or existing code
- Schema references (docs/schema/)
- API references (docs/api/)

### Step 2 — Decompose into Tasks

Break the spec into the minimum number of independently implementable
units. Each Task must satisfy ALL of the following rules:

RULE T1: One clear deliverable. The task is done when one specific thing
         works and is tested.
RULE T2: Single TDD session. Implementable in one focused session.
RULE T3: Self-contained context. A fresh agent with no memory of other
         tasks in this spec can implement this task by reading only:
         (a) this task's entry in the task list file, and
         (b) the relevant files in src/.
         It must NOT need to read other tasks to understand this one.
RULE T4: Own acceptance criteria. Each task lists a subset of the spec's
         acceptance criteria that it satisfies.
RULE T5: Explicit file list. Each task lists every file it will CREATE
         or MODIFY. No surprises.

IMPORTANT NAMING RULE: Tasks are numbered TASK-1, TASK-2, ... TASK-N.
The word "Phase" is NEVER used for tasks. "Phase" is reserved for the
app's release phasing in docs/phases/.

### Step 3 — Write the task list file

Save the task list to: docs/plans/SPEC-NNN-tasks.md
(Replace NNN with the actual spec number.)

Use EXACTLY this format — do not invent new sections or change the
structure:

====== START OF FILE TEMPLATE ======
# SPEC-NNN Task List — [Spec Title Here]
Status: ⏳ PENDING APPROVAL
Spec: docs/specs/[phase-folder]/SPEC-NNN-[slug].md

## Approval Checklist
- [ ] Task decomposition is correct
- [ ] Task order respects dependencies
- [ ] Scope matches the spec exactly
- [ ] Each task is self-contained (passes Rule T3)
- [ ] Ready to begin with TASK-1

---

## TASK-1: [Short imperative title — verb + noun, max 6 words]
Status: ⬜ not started

### Context
[2–4 sentences a fresh agent session needs to understand ONLY this task.
Include: what this task builds, what existing code it connects to, and
what the task before it produced (if any). Do not assume the agent
remembers any other task.]

### Files
[List every file this task touches. Use CREATE or MODIFY prefix.]
- CREATE: path/to/file.tsx
- MODIFY: path/to/existing-file.ts
- CREATE: path/to/__tests__/file.test.tsx

### Acceptance criteria
[Copy the relevant subset from the spec. Binary pass/fail only.]
- [ ] [criterion]
- [ ] [criterion]

### Start command
/tdd TASK-1 SPEC-NNN

---

## TASK-2: [Short imperative title]
Status: ⬜ not started
Depends on: TASK-1

### Context
[Self-contained context — see Rule T3 above.]

### Files
- CREATE or MODIFY entries

### Acceptance criteria
- [ ] [criterion]

### Start command
/tdd TASK-2 SPEC-NNN

---

[Repeat for all tasks]
====== END OF FILE TEMPLATE ======

### Step 4 — Print the stop message and HALT

After writing the file, print EXACTLY this block — nothing after it:

---
✅ PLAN COMPLETE

File written: docs/plans/SPEC-NNN-tasks.md
Tasks defined: [N]

Next step: review the task list, check the approval checklist, then run:
  /tdd TASK-1 SPEC-NNN

⛔ Implementation has NOT started.
⛔ No source files have been created or modified.
⛔ This session ends here. Awaiting your approval.
---

STOP. Do not write any code. Do not create any files in src/. Do not run
any commands. The session is over.
