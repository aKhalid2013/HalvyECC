BEGIN;
SELECT plan(8);

SELECT is( (SELECT count(*) FROM users), 2::bigint, 'Should have 2 users seeded' );
SELECT is( (SELECT count(*) FROM groups), 1::bigint, 'Should have 1 group seeded' );
SELECT is( (SELECT count(*) FROM group_members), 2::bigint, 'Should have 2 group_members seeded' );
SELECT is( (SELECT count(*) FROM expenses), 3::bigint, 'Should have 3 expenses seeded' );
SELECT is( (SELECT count(*) FROM line_items), 5::bigint, 'Should have 5 line_items seeded' );
SELECT cmp_ok( (SELECT count(*) FROM line_item_splits), '>=', 3::bigint, 'Should have at least 3 splits' );
SELECT is( (SELECT count(*) FROM payments), 1::bigint, 'Should have 1 payment seeded' );

-- Verify XOR integrity holds for ALL seeded expenses (not just one row)
SELECT is(
  (
    SELECT count(*)
    FROM expenses
    WHERE NOT (
      (payer_user_id IS NOT NULL AND payer_placeholder_id IS NULL) OR
      (payer_user_id IS NULL AND payer_placeholder_id IS NOT NULL)
    )
  ),
  0::bigint,
  'Payer XOR constraint should hold for all seeded expenses'
);

SELECT * FROM finish();
ROLLBACK;
