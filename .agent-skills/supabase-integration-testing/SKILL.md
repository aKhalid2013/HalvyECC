---
name: supabase-integration-testing
description: >
  Integration testing for Supabase RLS policies, edge functions, and auth flows
  using a local Supabase instance. Use when writing tests that verify database
  access control or API routes. Triggers: "RLS test", "integration test",
  "supabase test", "policy test", "local supabase", "supabase start",
  "test RLS", "verify access control".
origin: Halvy ECC
sources:
  - https://supabase.com/docs/guides/getting-started/local-development
  - https://supabase.com/docs/guides/database/testing
---

# Supabase Integration Testing — Halvy

## Concept

Integration tests run against a local Supabase instance (`supabase start`).
This provides a real Postgres + Auth + RLS environment, no cloud costs, no
shared state between runs. All migrations + seed data apply automatically.

## Setup

```bash
supabase start    # Start local Supabase via Docker
supabase db reset # Apply all migrations + supabase/seed.sql (clean state)
npm run test:integration
supabase stop
```

## .env.test (gitignored)

```
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=<from supabase start output>
SUPABASE_SERVICE_ROLE_KEY=<from supabase start output>
TEST_USER_EMAIL=testuser@halvy.test
TEST_USER_EMAIL_2=testuser2@halvy.test
PLAYWRIGHT_BASE_URL=http://localhost:8081
```

## Test Client Pattern

```typescript
// src/__tests__/helpers/supabaseTestClient.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// Authenticated user client (respects RLS)
export function createUserClient(userJwt: string) {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${userJwt}` } } }
  );
}

// Service role client (bypasses RLS — test setup/teardown only)
export function createServiceClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
```

## RLS Policy Test Pattern

```typescript
// src/__tests__/rls/expenses.integration.test.ts
describe('expenses RLS', () => {
  const service = createServiceClient();
  let groupId: string;
  let user1Jwt: string;
  let user2Jwt: string;

  beforeAll(async () => {
    // Create group with user1 only — via service role (bypasses RLS)
    ({ jwt: user1Jwt } = await signInTestUser(process.env.TEST_USER_EMAIL!));
    ({ jwt: user2Jwt } = await signInTestUser(process.env.TEST_USER_EMAIL_2!));
    // ... create group, add user1 as member
  });

  it('user1 can read expenses in their group', async () => {
    const client = createUserClient(user1Jwt);
    const { data, error } = await client
      .from('expenses').select('*').eq('group_id', groupId);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it('user2 cannot read expenses in a group they do not belong to', async () => {
    const client = createUserClient(user2Jwt);
    const { data, error } = await client
      .from('expenses').select('*').eq('group_id', groupId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0); // RLS returns empty, not an error
  });

  it('user2 cannot insert expenses into a foreign group', async () => {
    const client = createUserClient(user2Jwt);
    const { error } = await client.from('expenses').insert({
      group_id: groupId,
      description: 'Unauthorized',
      total_cents: 1000,
      currency: 'EGP',
      split_type: 'equal',
    });
    expect(error).not.toBeNull();
    expect(error!.code).toBe('42501'); // PostgreSQL: insufficient_privilege
  });
});
```

## RLS Verification SQL (run in spec-verifier)

```sql
-- Verify: no tables have RLS disabled
SELECT tablename FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = false;
-- Expected: 0 rows

-- Verify: all RLS-enabled tables have at least one policy
SELECT tablename FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = true
  AND tablename NOT IN (
    SELECT tablename FROM pg_policies WHERE schemaname = 'public'
  );
-- Expected: 0 rows
```

## CI Integration

```yaml
- uses: supabase/setup-cli@v1
  with: { version: latest }
- run: supabase start
- run: npm run test:integration
  env:
    SUPABASE_URL: http://localhost:54321
    SUPABASE_ANON_KEY: ${{ env.SUPABASE_LOCAL_ANON_KEY }}
    SUPABASE_SERVICE_ROLE_KEY: ${{ env.SUPABASE_LOCAL_SERVICE_ROLE_KEY }}
- run: supabase stop
```
