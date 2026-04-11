BEGIN;
SELECT plan(15); -- Adjust count as needed

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

SELECT * FROM finish();
ROLLBACK;
