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

### Step 4: Write Feedback Log
After writing the .report.md, also write a structured JSON summary.

**File path:** `feedback-logs/verifications/SPEC-{NNN}.json`

**Required fields:**

```json
{
  "spec_id": "SPEC-NNN",
  "date": "YYYY-MM-DD",
  "platform": "claude_code",
  "verdict": "PASS | FAIL | PARTIAL",
  "criteria_total": 8,
  "criteria_pass": 6,
  "criteria_fail": 1,
  "criteria_partial": 1,
  "failure_categories": ["missing_edge_case_test", "rls_policy_mismatch"],
  "dev_iterations_before_verify": 2,
  "time_from_spec_approval_days": 3
}
```

**Schema reference:** `feedback-schemas/verification-result.schema.json`
