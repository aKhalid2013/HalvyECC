BEGIN;
SELECT plan(16);

-- Verify foreign key and soft-delete indexes
SELECT has_index('public', 'group_members', 'idx_group_members_group_id', 'group_members_group_id index exists');
SELECT has_index('public', 'group_members', 'idx_group_members_user_id', 'group_members_user_id index exists');

SELECT has_index('public', 'expenses', 'idx_expenses_group_id', 'expenses_group_id index exists');
SELECT has_index('public', 'expenses', 'idx_expenses_active_group_created', 'expenses_active_group_created index exists');

SELECT has_index('public', 'line_item_splits', 'idx_line_item_splits_expense_id', 'line_item_splits_expense_id index exists');
SELECT has_index('public', 'line_item_splits', 'idx_line_item_splits_line_item_id', 'line_item_splits_line_item_id index exists');
SELECT has_index('public', 'line_item_splits', 'idx_line_item_splits_user_id', 'line_item_splits_user_id index exists');

SELECT has_index('public', 'payments', 'idx_payments_group_id', 'payments_group_id index exists');
SELECT has_index('public', 'payments', 'idx_payments_from_user', 'payments_from_user index exists');
SELECT has_index('public', 'payments', 'idx_payments_to_user', 'payments_to_user index exists');
SELECT has_index('public', 'payments', 'idx_payments_active_group_created', 'payments_active_group_created index exists');

SELECT has_index('public', 'messages', 'idx_messages_group_id_created', 'messages_group_id_created index exists');
SELECT has_index('public', 'messages', 'idx_messages_active_group_created', 'messages_active_group_created index exists');

SELECT has_index('public', 'mentions', 'idx_mentions_mentioned_user', 'mentions_mentioned_user index exists');
SELECT has_index('public', 'mentions', 'idx_mentions_message_id', 'mentions_message_id index exists');

-- Verify the partial unique index
SELECT has_index('public', 'group_members', 'one_owner_per_group', 'one_owner_per_group unique partial index exists');

SELECT * FROM finish();
ROLLBACK;
