# Review Context — PR Review Mode

- Group findings by severity: CRITICAL > HIGH > MEDIUM > LOW
- Check Halvy-specific rules: integer cents, RLS on all tables,
  Gemini calls via proxy only, Zod at boundaries
- Verify spec alignment: does the code match the approved spec?
- Flag missing tests for acceptance criteria
- Check file sizes — flag any file over 300 lines
- Do not modify code — report findings only
- Reference ECC rules in .claude/rules/ for standards
