# docs/plans/

Task list files produced by the /plan command live here.
One file per spec: SPEC-NNN-tasks.md

## Lifecycle

1. /plan writes SPEC-NNN-tasks.md and STOPS (Status: ⏳ PENDING APPROVAL)
2. Developer reviews the task list and checks the approval checklist
3. Developer runs /tdd TASK-1 SPEC-NNN to begin
4. After each task, agent marks it ✅ done and STOPS
5. Developer runs /tdd TASK-N+1 SPEC-NNN for the next task
6. All tasks done → spec-verifier agent → merge → ship

## Naming Rules

- Tasks are numbered TASK-1, TASK-2, ... TASK-N
- The word "Phase" is NEVER used here
- "Phase" belongs exclusively in docs/phases/ (app release strategy)
- Task files are named: SPEC-NNN-tasks.md
