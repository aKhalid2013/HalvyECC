BEGIN;
SELECT plan(24);

-- Setup initial test data
INSERT INTO users (id, email, display_name, auth_provider)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'user1@example.com', 'User One', 'google'),
  ('22222222-2222-2222-2222-222222222222', 'user2@example.com', 'User Two', 'google');

INSERT INTO groups (id, name, group_type, owner_id)
VALUES ('00000000-0000-0000-0000-000000000001', 'Group One', 'dinner', '11111111-1111-1111-1111-111111111111');

INSERT INTO group_members (group_id, user_id, role)
VALUES ('00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'owner');

-- 1. Test Anon Access
SET LOCAL ROLE anon;
SELECT is_empty('SELECT * FROM users', 'Anon should see nothing in users');
SELECT is_empty('SELECT * FROM groups', 'Anon should see nothing in groups');

-- 2. Test User Isolation
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111"}', true);

SELECT results_eq(
    'SELECT id FROM users',
    ARRAY['11111111-1111-1111-1111-111111111111'::uuid],
    'User One should only see their own user record'
);

-- 3. Test Group Isolation
-- User Two is NOT in Group One
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222"}', true);

SELECT is_empty(
    'SELECT id FROM groups WHERE id = ''00000000-0000-0000-0000-000000000001''',
    'User Two should not see Group One'
);

-- 4. Test Deny-All
SELECT is_empty('SELECT * FROM rate_limits', 'Auth user should not see rate_limits');

-- 5. Test Group Admin Update
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111"}', true);
SELECT lives_ok(
    'UPDATE groups SET name = ''New Name'' WHERE id = ''00000000-0000-0000-0000-000000000001''',
    'Owner can update group name'
);

-- Reset role to insert more test data
RESET ROLE;
INSERT INTO users (id, email, display_name, auth_provider)
VALUES ('33333333-3333-3333-3333-333333333333', 'user3@example.com', 'User Three', 'google');
INSERT INTO group_members (group_id, user_id, role)
VALUES ('00000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'member');

INSERT INTO expenses (id, group_id, creator_user_id, payer_user_id, title, total_amount, currency)
VALUES ('00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Dinner', 10.00, 'USD');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333"}', true);
-- This should fail to update any rows
SELECT results_eq(
    'UPDATE groups SET name = ''Hacker Name'' WHERE id = ''00000000-0000-0000-0000-000000000001'' RETURNING id',
    '{}'::uuid[],
    'Regular member cannot update group name'
);

-- 6. Test Expense Deletion
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333"}', true);
-- User Three (regular member) tries to delete User One's expense
SELECT results_eq(
    'DELETE FROM expenses WHERE id = ''00000000-0000-0000-0000-000000000100'' RETURNING id',
    '{}'::uuid[],
    'Regular member cannot delete someone else''s expense'
);

-- 7. Restore role for RLS checks
RESET ROLE;

-- Verify RLS is enabled on all 16 tables
SELECT ok(relrowsecurity, 'RLS should be enabled on ' || relname) 
FROM pg_class 
WHERE relname IN (
  'users', 'groups', 'group_members', 'placeholders', 'expenses', 
  'line_items', 'line_item_splits', 'payments', 'messages', 'mentions', 
  'message_reactions', 'standing_orders', 'notifications', 'group_invites', 
  'rate_limits', 'ai_budget'
)
AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

SELECT * FROM finish();
ROLLBACK;
