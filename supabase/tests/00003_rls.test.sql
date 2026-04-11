BEGIN;
SELECT plan(10); -- Start with 10 tests

-- Setup test data
INSERT INTO users (id, email, display_name, auth_provider)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'user1@example.com', 'User One', 'google'),
  ('22222222-2222-2222-2222-222222222222', 'user2@example.com', 'User Two', 'google');

INSERT INTO groups (id, name, group_type, owner_id)
VALUES ('00000000-0000-0000-0000-000000000001', 'Group One', 'dinner', '11111111-1111-1111-1111-111111111111');

INSERT INTO group_members (group_id, user_id, role)
VALUES ('00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'owner');

-- 1. Test Anon Access (Should fail currently)
SET LOCAL ROLE anon;
SELECT is_empty('SELECT * FROM users', 'Anon should see nothing in users');
SELECT is_empty('SELECT * FROM groups', 'Anon should see nothing in groups');

-- 2. Test User Isolation (Should fail currently)
SET LOCAL ROLE authenticated;
-- Set auth.uid() to User One
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111"}', true);

SELECT results_eq(
    'SELECT id FROM users',
    ARRAY['11111111-1111-1111-1111-111111111111'::uuid],
    'User One should only see their own user record'
);

-- 3. Test Group Isolation (Should fail currently)
-- User Two is NOT in Group One
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222"}', true);

SELECT is_empty(
    'SELECT id FROM groups WHERE id = ''00000000-0000-0000-0000-000000000001''',
    'User Two should not see Group One'
);

-- 4. Test Deny-All (Should fail currently)
SELECT is_empty('SELECT * FROM rate_limits', 'Auth user should not see rate_limits');

-- 5. Restore role for setup
RESET ROLE;

-- Verify RLS is enabled on all tables (Should fail currently)
SELECT has_comment('table', 'users', 'RLS is enabled on users') IS FALSE; -- Temporary check logic

-- Actually, pgTAP doesn't have a direct "is RLS enabled" check easily accessible without querying pg_class.
-- We can check if relrowsecurity is true in pg_class.
SELECT ok(relrowsecurity, 'RLS should be enabled on users') FROM pg_class WHERE relname = 'users';
SELECT ok(relrowsecurity, 'RLS should be enabled on groups') FROM pg_class WHERE relname = 'groups';
SELECT ok(relrowsecurity, 'RLS should be enabled on expenses') FROM pg_class WHERE relname = 'expenses';
SELECT ok(relrowsecurity, 'RLS should be enabled on payments') FROM pg_class WHERE relname = 'payments';
SELECT ok(relrowsecurity, 'RLS should be enabled on messages') FROM pg_class WHERE relname = 'messages';

SELECT * FROM finish();
ROLLBACK;
