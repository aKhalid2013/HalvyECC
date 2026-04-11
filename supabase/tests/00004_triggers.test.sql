BEGIN;
SELECT plan(33); -- Updated for more tests

-- 1. Verify Trigger Functions Exist
SELECT has_function('public', 'fn_balance_broadcast', 'fn_balance_broadcast should exist');
SELECT has_function('public', 'fn_expense_create_msg', 'fn_expense_create_msg should exist');
SELECT has_function('public', 'fn_expense_edit_msg', 'fn_expense_edit_msg should exist');
SELECT has_function('public', 'fn_expense_delete_msg', 'fn_expense_delete_msg should exist');
SELECT has_function('public', 'fn_payment_msg', 'fn_payment_msg should exist');
SELECT has_function('public', 'fn_owner_transfer', 'fn_owner_transfer should exist');
SELECT has_function('public', 'fn_placeholder_claim_check', 'fn_placeholder_claim_check should exist');
SELECT has_function('public', 'fn_mention_notification', 'fn_mention_notification should exist');
SELECT has_function('public', 'fn_item_reassign_notification', 'fn_item_reassign_notification should exist');
SELECT has_function('public', 'fn_standing_order_execute', 'fn_standing_order_execute should exist');

-- 2. Verify Triggers Exist on Tables
SELECT has_trigger('public', 'expenses', 'trg_expense_create_msg', 'trg_expense_create_msg should be on expenses');
SELECT has_trigger('public', 'expenses', 'trg_expense_edit_msg', 'trg_expense_edit_msg should be on expenses');
SELECT has_trigger('public', 'expenses', 'trg_expense_delete_msg', 'trg_expense_delete_msg should be on expenses');
SELECT has_trigger('public', 'payments', 'trg_payment_msg', 'trg_payment_msg should be on payments');
SELECT has_trigger('public', 'mentions', 'trg_mention_notification', 'trg_mention_notification should be on mentions');

-- 3. Behavioral Tests

-- Setup: Create a user and a group
INSERT INTO users (id, email, display_name, auth_provider)
VALUES ('06060606-0606-0606-0606-060606060606', 'test@example.com', 'Test User', 'google');

INSERT INTO groups (id, name, group_type, owner_id)
VALUES ('00000000-0000-0000-0000-000000000010', 'Test Group', 'dinner', '06060606-0606-0606-0606-060606060606');

INSERT INTO group_members (group_id, user_id, role)
VALUES ('00000000-0000-0000-0000-000000000010', '06060606-0606-0606-0606-060606060606', 'owner');

-- 3.1. Expense Create Message
INSERT INTO expenses (id, group_id, creator_user_id, payer_user_id, title, total_amount, currency)
VALUES ('07070707-0707-0707-0707-070707070707', '00000000-0000-0000-0000-000000000010', '06060606-0606-0606-0606-060606060606', '06060606-0606-0606-0606-060606060606', 'Dinner expense', 50.00, 'USD');

-- 3.2. Expense Edit Message
UPDATE expenses SET title = 'Updated Dinner' WHERE id = '07070707-0707-0707-0707-070707070707';

-- 3.3. Expense Delete Message
UPDATE expenses SET deleted_at = now() WHERE id = '07070707-0707-0707-0707-070707070707';

-- Note: auth.uid() returns NULL in the pgTAP test context (no authenticated session),
-- so the editor name falls back to 'Someone' via COALESCE in fn_expense_edit_msg.
SELECT results_eq(
  'SELECT body FROM messages WHERE expense_id = ''07070707-0707-0707-0707-070707070707'' ORDER BY created_at ASC',
  ARRAY[
    'Test User added "Dinner expense"',
    'Someone edited "Updated Dinner"',
    'Expense "Updated Dinner" was deleted'
  ],
  'Should record full expense lifecycle in messages'
);

-- 3.4. Payment Message
INSERT INTO payments (id, group_id, from_user_id, to_user_id, amount, currency)
VALUES ('08080808-0808-0808-0808-080808080808', '00000000-0000-0000-0000-000000000010', '06060606-0606-0606-0606-060606060606', '06060606-0606-0606-0606-060606060606', 25.00, 'USD');

SELECT results_eq(
  'SELECT body FROM messages WHERE payment_id = ''08080808-0808-0808-0808-080808080808''',
  ARRAY['Test User paid Test User · $25.00'],
  'Should create a system message when payment is recorded'
);

-- 3.5. Owner Transfer
INSERT INTO users (id, email, display_name, auth_provider)
VALUES ('00000000-0000-0000-0000-000000000002', 'member@example.com', 'Member User', 'google');

INSERT INTO group_members (group_id, user_id, role, joined_at)
VALUES ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000002', 'member', now() + interval '1 hour');

UPDATE users SET deleted_at = now() WHERE id = '06060606-0606-0606-0606-060606060606';

SELECT results_eq(
  'SELECT owner_id FROM groups WHERE id = ''00000000-0000-0000-0000-000000000010''',
  ARRAY['00000000-0000-0000-0000-000000000002'::uuid],
  'Should transfer ownership to the next earliest member'
);

-- 3.6. Placeholder Claim Check
INSERT INTO placeholders (id, group_id, display_name, email)
VALUES ('00000000-0000-0000-0000-000000000300', '00000000-0000-0000-0000-000000000010', 'Claimable', 'claim@example.com');

INSERT INTO users (id, email, display_name, auth_provider)
VALUES ('00000000-0000-0000-0000-000000000003', 'claim@example.com', 'Claimant', 'google');

SELECT results_eq(
  'SELECT notification_type FROM notifications WHERE user_id = ''00000000-0000-0000-0000-000000000003''',
  ARRAY['placeholder_claim_available'::notification_type],
  'Should create a notification for new users matching placeholders'
);

-- 3.7. Mention Notification
INSERT INTO messages (id, group_id, sender_user_id, message_type, body)
VALUES ('00000000-0000-0000-0000-000000000400', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000002', 'user_text', 'Hi @Claimant');

INSERT INTO mentions (message_id, group_id, mentioned_user_id, mentioner_user_id)
VALUES ('00000000-0000-0000-0000-000000000400', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002');

SELECT results_eq(
  'SELECT notification_type FROM notifications WHERE user_id = ''00000000-0000-0000-0000-000000000003'' AND notification_type = ''mention''',
  ARRAY['mention'::notification_type],
  'Should create a mention notification'
);

-- 3.8. Item Reassignment Notification
INSERT INTO line_items (id, expense_id, description, amount, position)
VALUES ('00000000-0000-0000-0000-000000000500', (SELECT id FROM expenses LIMIT 1), 'Pizza', 20.00, 1);

INSERT INTO line_item_splits (id, line_item_id, expense_id, user_id, amount)
VALUES ('00000000-0000-0000-0000-000000000600', '00000000-0000-0000-0000-000000000500', (SELECT id FROM expenses LIMIT 1), '00000000-0000-0000-0000-000000000002', 20.00);

UPDATE line_item_splits SET user_id = '00000000-0000-0000-0000-000000000003' WHERE id = '00000000-0000-0000-0000-000000000600';

SELECT results_eq(
  'SELECT notification_type FROM notifications WHERE notification_type = ''item_reassigned''',
  ARRAY['item_reassigned'::notification_type],
  'Should create an item assigned notification when user_id changes'
);

-- 3.9. Moddatetime
-- Use a separate user to avoid transaction timestamp issues if needed,
-- but moddatetime uses clock_timestamp usually or it advances as expected.
INSERT INTO users (id, email, display_name, auth_provider, updated_at)
VALUES ('00000000-0000-0000-0000-000000000004', 'mod@example.com', 'Mod User', 'google', '2000-01-01 00:00:00Z');

UPDATE users SET display_name = 'Mod Changed' WHERE id = '00000000-0000-0000-0000-000000000004';

SELECT results_eq(
  'SELECT updated_at > ''2000-01-01 00:00:00Z''::timestamptz FROM users WHERE id = ''00000000-0000-0000-0000-000000000004''',
  ARRAY[true],
  'updated_at should be advanced by moddatetime trigger'
);

-- Verify updated_at advanced
-- Since we are in a transaction, now() might be the same.
-- But moddatetime usually uses current_timestamp.
-- We'll just verify the handle_updated_at_users trigger exists as a check for moddatetime coverage.
SELECT has_trigger('public', 'users', 'handle_updated_at_users', 'handle_updated_at_users trigger should exist');
SELECT has_trigger('public', 'groups', 'handle_updated_at_groups', 'handle_updated_at_groups trigger should exist');
SELECT has_trigger('public', 'group_members', 'handle_updated_at_group_members', 'handle_updated_at_group_members trigger should exist');
SELECT has_trigger('public', 'placeholders', 'handle_updated_at_placeholders', 'handle_updated_at_placeholders trigger should exist');
SELECT has_trigger('public', 'expenses', 'handle_updated_at_expenses', 'handle_updated_at_expenses trigger should exist');
SELECT has_trigger('public', 'line_items', 'handle_updated_at_line_items', 'handle_updated_at_line_items trigger should exist');
SELECT has_trigger('public', 'line_item_splits', 'handle_updated_at_line_item_splits', 'handle_updated_at_line_item_splits trigger should exist');
SELECT has_trigger('public', 'payments', 'handle_updated_at_payments', 'handle_updated_at_payments trigger should exist');
SELECT has_trigger('public', 'standing_orders', 'handle_updated_at_standing_orders', 'handle_updated_at_standing_orders trigger should exist');
SELECT has_trigger('public', 'rate_limits', 'handle_updated_at_rate_limits', 'handle_updated_at_rate_limits trigger should exist');
SELECT has_trigger('public', 'ai_budget', 'handle_updated_at_ai_budget', 'handle_updated_at_ai_budget trigger should exist');


SELECT * FROM finish();
ROLLBACK;
