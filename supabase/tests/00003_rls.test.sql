BEGIN;
SELECT plan(27);

-- Setup initial test data
INSERT INTO users (id, email, display_name, auth_provider)
VALUES 
  ('30303030-3030-3030-3030-303030303030', 'user1@example.com', 'User One', 'google'),
  ('40404040-4040-4040-4040-404040404040', 'user2@example.com', 'User Two', 'google');

INSERT INTO groups (id, name, group_type, owner_id)
VALUES ('03030303-0303-0303-0303-030303030303', 'Group One', 'dinner', '30303030-3030-3030-3030-303030303030');

INSERT INTO group_members (group_id, user_id, role)
VALUES ('03030303-0303-0303-0303-030303030303', '30303030-3030-3030-3030-303030303030', 'owner');

-- 1. Test Anon Access
SET LOCAL ROLE anon;
SELECT is_empty('SELECT * FROM users', 'Anon should see nothing in users');
SELECT is_empty('SELECT * FROM groups', 'Anon should see nothing in groups');

-- 2. Test User Isolation
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "30303030-3030-3030-3030-303030303030"}', true);

SELECT results_eq(
    'SELECT id FROM users',
    ARRAY['30303030-3030-3030-3030-303030303030'::uuid],
    'User One should only see their own user record'
);

-- 3. Test Group Isolation
-- User Two is NOT in Group One
SELECT set_config('request.jwt.claims', '{"sub": "40404040-4040-4040-4040-404040404040"}', true);

SELECT is_empty(
    'SELECT id FROM groups WHERE id = ''03030303-0303-0303-0303-030303030303''',
    'User Two should not see Group One'
);

-- 4. Test Deny-All
SELECT is_empty('SELECT * FROM rate_limits', 'Auth user should not see rate_limits');
SELECT is_empty('SELECT * FROM ai_budget', 'Auth user should not see ai_budget');
SELECT throws_ok(
    'INSERT INTO rate_limits (user_id, action, window_start) VALUES (''30303030-3030-3030-3030-303030303030'', ''test'', now())',
    'new row violates row-level security policy for table "rate_limits"',
    'Auth user cannot insert into rate_limits'
);
SELECT throws_ok(
    'INSERT INTO ai_budget (month_key, budget_limit) VALUES (''2099-01'', 100)',
    'new row violates row-level security policy for table "ai_budget"',
    'Auth user cannot insert into ai_budget'
);

-- 5. Test Group Admin Update
SELECT set_config('request.jwt.claims', '{"sub": "30303030-3030-3030-3030-303030303030"}', true);
SELECT lives_ok(
    'UPDATE groups SET name = ''New Name'' WHERE id = ''03030303-0303-0303-0303-030303030303''',
    'Owner can update group name'
);

-- Reset role to insert more test data
RESET ROLE;
INSERT INTO users (id, email, display_name, auth_provider)
VALUES ('50505050-5050-5050-5050-505050505050', 'user3@example.com', 'User Three', 'google');
INSERT INTO group_members (group_id, user_id, role)
VALUES ('03030303-0303-0303-0303-030303030303', '50505050-5050-5050-5050-505050505050', 'member');

INSERT INTO expenses (id, group_id, creator_user_id, payer_user_id, title, total_amount, currency)
VALUES ('04040404-0404-0404-0404-040404040404', '03030303-0303-0303-0303-030303030303', '30303030-3030-3030-3030-303030303030', '30303030-3030-3030-3030-303030303030', 'Dinner', 10.00, 'USD');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "50505050-5050-5050-5050-505050505050"}', true);
-- This should fail to update any rows
SELECT results_eq(
    'UPDATE groups SET name = ''Hacker Name'' WHERE id = ''03030303-0303-0303-0303-030303030303'' RETURNING id',
    '{}'::uuid[],
    'Regular member cannot update group name'
);

-- 6. Test Expense Deletion
SELECT set_config('request.jwt.claims', '{"sub": "50505050-5050-5050-5050-505050505050"}', true);
-- User Three (regular member) tries to delete User One's expense
SELECT results_eq(
    'DELETE FROM expenses WHERE id = ''04040404-0404-0404-0404-040404040404'' RETURNING id',
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
