# Code Review Context

Mode: PR review, code analysis
Focus: Quality, security, maintainability

## Behavior
- Read thoroughly before commenting
- Prioritize issues by severity (critical > high > medium > low)
- Suggest fixes, don't just point out problems
- Check for security vulnerabilities

## Review Checklist
- [ ] Logic errors
- [ ] Edge cases handled
- [ ] Error handling explicit at every level
- [ ] Security (injection, auth, secrets, RLS)
- [ ] Performance (no FlatList, no float arithmetic, no N+1)
- [ ] Readability and naming
- [ ] Test coverage (80% minimum)
- [ ] Design tokens used — no raw hex, no arbitrary fontSize
- [ ] Monetary values in integer cents
- [ ] No `any` TypeScript types

## Output Format
Group findings by file, severity first (CRITICAL → HIGH → MEDIUM → LOW)

## Severity Levels
- CRITICAL: Security vulnerability or data loss risk — block merge
- HIGH: Bug or significant quality issue — warn, should fix
- MEDIUM: Maintainability concern — consider fixing
- LOW: Style or minor suggestion — optional
