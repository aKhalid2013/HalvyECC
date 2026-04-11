BEGIN;
SELECT plan(15);

-- Setup
INSERT INTO users (id, email, display_name, auth_provider)
VALUES 
  ('10101010-1010-1010-1010-101010101010', 'test1@e.com', 'T1', 'google'),
  ('20202020-2020-2020-2020-202020202020', 'test2@e.com', 'T2', 'google');

INSERT INTO groups (id, name, group_type, owner_id)
VALUES ('05050505-0505-0505-0505-050505050505', 'Test G', 'dinner', '10101010-1010-1010-1010-101010101010');

INSERT INTO placeholders (id, group_id, display_name)
VALUES ('90909090-9090-9090-9090-909090909090', '05050505-0505-0505-0505-050505050505', 'P1');

-- 1. Test XOR on group_members (member_xor_placeholder)
-- Both NULL -> Fails
SELECT throws_ok(
  'INSERT INTO group_members (group_id, role) VALUES (''05050505-0505-0505-0505-050505050505'', ''member'')',
  '23514',
  NULL,
  'group_members member_xor_placeholder: Both user_id and placeholder_id NULL should fail'
);

-- Both Set -> Fails
SELECT throws_ok(
  'INSERT INTO group_members (group_id, user_id, placeholder_id, role) VALUES (''05050505-0505-0505-0505-050505050505'', ''10101010-1010-1010-1010-101010101010'', ''90909090-9090-9090-9090-909090909090'', ''member'')',
  '23514',
  NULL,
  'group_members member_xor_placeholder: Both user_id and placeholder_id SET should fail'
);

-- Only user_id -> Passes
SELECT lives_ok(
  'INSERT INTO group_members (group_id, user_id, role) VALUES (''05050505-0505-0505-0505-050505050505'', ''10101010-1010-1010-1010-101010101010'', ''owner'')',
  'group_members member_xor_placeholder: Only user_id should pass'
);

-- 2. Test one_owner_per_group unique index
SELECT throws_ok(
  'INSERT INTO group_members (group_id, user_id, role) VALUES (''05050505-0505-0505-0505-050505050505'', ''20202020-2020-2020-2020-202020202020'', ''owner'')',
  '23505',
  NULL,
  'Second owner in same group should violate one_owner_per_group unique index'
);

-- 3. Test XOR on expenses (payer_xor_placeholder)
-- Both set -> Fails
SELECT throws_ok(
  'INSERT INTO expenses (group_id, payer_user_id, payer_placeholder_id, title, total_amount, currency) VALUES (''05050505-0505-0505-0505-050505050505'', ''10101010-1010-1010-1010-101010101010'', ''90909090-9090-9090-9090-909090909090'', ''T1'', 10, ''USD'')',
  '23514',
  NULL,
  'expenses payer_xor_placeholder: Both payer_user_id and payer_placeholder_id SET should fail'
);

-- Only user_id -> Passes
SELECT lives_ok(
  'INSERT INTO expenses (id, group_id, payer_user_id, title, total_amount, currency) VALUES (''01010101-0101-0101-0101-010101010101'', ''05050505-0505-0505-0505-050505050505'', ''10101010-1010-1010-1010-101010101010'', ''T1'', 10, ''USD'')',
  'expenses payer_xor_placeholder: Only user_id should pass'
);

-- 4. Test XOR on line_item_splits (line_split_xor_placeholder)
-- Add a line item first
INSERT INTO line_items (id, expense_id, description, amount, position) VALUES ('02020202-0202-0202-0202-020202020202', '01010101-0101-0101-0101-010101010101', 'L1', 10, 1);

-- Both NULL -> Fails
SELECT throws_ok(
  'INSERT INTO line_item_splits (line_item_id, expense_id, amount) VALUES (''02020202-0202-0202-0202-020202020202'', ''01010101-0101-0101-0101-010101010101'', 10)',
  '23514',
  NULL,
  'line_item_splits line_split_xor_placeholder: Both NULL should fail'
);

-- Both Set -> Fails
SELECT throws_ok(
  'INSERT INTO line_item_splits (line_item_id, expense_id, user_id, placeholder_id, amount) VALUES (''02020202-0202-0202-0202-020202020202'', ''01010101-0101-0101-0101-010101010101'', ''10101010-1010-1010-1010-101010101010'', ''90909090-9090-9090-9090-909090909090'', 10)',
  '23514',
  NULL,
  'line_item_splits line_split_xor_placeholder: Both SET should fail'
);

-- Only user_id -> Passes
SELECT lives_ok(
  'INSERT INTO line_item_splits (line_item_id, expense_id, user_id, amount) VALUES (''02020202-0202-0202-0202-020202020202'', ''01010101-0101-0101-0101-010101010101'', ''10101010-1010-1010-1010-101010101010'', 10)',
  'line_item_splits line_split_xor_placeholder: Only user_id should pass'
);

-- 5. Test XOR on payments
-- From User + From Placeholder -> Fails
SELECT throws_ok(
  'INSERT INTO payments (group_id, from_user_id, from_placeholder_id, to_user_id, amount, currency) VALUES (''05050505-0505-0505-0505-050505050505'', ''10101010-1010-1010-1010-101010101010'', ''90909090-9090-9090-9090-909090909090'', ''20202020-2020-2020-2020-202020202020'', 10, ''USD'')',
  '23514',
  NULL,
  'payments payment_from_xor_placeholder: Both from_user and from_placeholder SET should fail'
);

-- To User + To Placeholder -> Fails
SELECT throws_ok(
  'INSERT INTO payments (group_id, from_user_id, to_user_id, to_placeholder_id, amount, currency) VALUES (''05050505-0505-0505-0505-050505050505'', ''10101010-1010-1010-1010-101010101010'', ''20202020-2020-2020-2020-202020202020'', ''90909090-9090-9090-9090-909090909090'', 10, ''USD'')',
  '23514',
  NULL,
  'payments payment_to_xor_placeholder: Both to_user and to_placeholder SET should fail'
);

-- Proper payment -> Passes
SELECT lives_ok(
  'INSERT INTO payments (group_id, from_user_id, to_user_id, amount, currency) VALUES (''05050505-0505-0505-0505-050505050505'', ''10101010-1010-1010-1010-101010101010'', ''20202020-2020-2020-2020-202020202020'', 10, ''USD'')',
  'payments with valid XOR should pass'
);

-- 6. Test fixed_split_requires_rule
-- fixed without rule -> Fails
SELECT throws_ok(
  'INSERT INTO standing_orders (group_id, title, total_amount, recurrence_every, recurrence_unit, split_mode, first_run_at, next_run_at) VALUES (''05050505-0505-0505-0505-050505050505'', ''SO1'', 10, 1, ''week'', ''fixed'', now(), now())',
  '23514',
  NULL,
  'standing_orders fixed_split_requires_rule: fixed split mode without rule should fail'
);

-- fixed with rule -> Passes
SELECT lives_ok(
  'INSERT INTO standing_orders (group_id, title, total_amount, recurrence_every, recurrence_unit, split_mode, split_rule, first_run_at, next_run_at) VALUES (''05050505-0505-0505-0505-050505050505'', ''SO1'', 10, 1, ''week'', ''fixed'', ''{}'', now(), now())',
  'standing_orders fixed_split_requires_rule: fixed split mode WITH rule should pass'
);

-- collaborative without rule -> Passes
SELECT lives_ok(
  'INSERT INTO standing_orders (group_id, title, total_amount, recurrence_every, recurrence_unit, split_mode, first_run_at, next_run_at) VALUES (''05050505-0505-0505-0505-050505050505'', ''SO2'', 10, 1, ''week'', ''collaborative'', now(), now())',
  'standing_orders fixed_split_requires_rule: collaborative split mode without rule should pass'
);

SELECT * FROM finish();
ROLLBACK;
