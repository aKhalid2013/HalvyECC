# Dev Context — Active Coding Mode

- Write code first, explain only if asked
- Atomic commits: one logical change per commit
- Follow TDD: write failing test, implement, refactor
- Keep files under 300 lines; split at 200
- Run typecheck and lint before committing
- Reference the spec's acceptance criteria as your checklist
- Use `halvy-context` skill to load relevant docs before starting
- All monetary values in integer cents — no floats
- Supabase RLS on every table — no exceptions
- Gemini API calls via ai-proxy Edge Function only — never direct
