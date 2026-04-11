-- Halvy Development Seed Data
-- For use in local development and testing only.
-- Hardcoded UUIDs are used for deterministic testing.

-- 1. Create Users
INSERT INTO public.users (id, email, display_name, auth_provider)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'khalid@test.com', 'Khalid Ahmed', 'google'),
  ('22222222-2222-2222-2222-222222222222', 'sara@test.com', 'Sara Kim', 'google');

-- 2. Create Group
INSERT INTO public.groups (id, name, group_type, currency, owner_id)
VALUES ('00000000-0000-0000-0000-000000000001', 'Dubai Trip', 'trip', 'USD', '11111111-1111-1111-1111-111111111111');

-- 3. Add Members
INSERT INTO public.group_members (group_id, user_id, role)
VALUES 
  ('00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('00000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'member');

-- 4. Create Expenses

-- Expense 1: Khalid (User 1) paid for Dinner (50.00). Sara (User 2) owes half of one item.
-- Total: 50.00 (Burger 30.00, Pizza 20.00)
INSERT INTO public.expenses (id, group_id, creator_user_id, payer_user_id, title, total_amount, currency)
VALUES ('00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Dinner at Cheesecake Factory', 50.00, 'USD');

INSERT INTO public.line_items (id, expense_id, description, amount, position)
VALUES 
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000100', 'Big Burger', 30.00, 1),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000100', 'Small Pizza', 20.00, 2);

-- Sara splits the Pizza (10.00 each)
INSERT INTO public.line_item_splits (line_item_id, expense_id, user_id, amount)
VALUES 
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000100', '11111111-1111-1111-1111-111111111111', 10.00),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000100', '22222222-2222-2222-2222-222222222222', 10.00);

-- Expense 2: Sara (User 2) paid for Grocery (25.00). Tax included.
-- Total: 25.00 (Items 23.00, Tax 2.00)
INSERT INTO public.expenses (id, group_id, creator_user_id, payer_user_id, title, total_amount, currency)
VALUES ('00000000-0000-0000-0000-000000000200', '00000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Carrefour Grocery', 25.00, 'USD');

INSERT INTO public.line_items (id, expense_id, description, amount, is_tax, position)
VALUES 
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000200', 'Various Snacks', 23.00, false, 1),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000200', 'VAT 5%', 2.00, true, 2);

-- Khalid assigned to the snacks (23.00). Tax usually follows split or payer.
INSERT INTO public.line_item_splits (line_item_id, expense_id, user_id, amount)
VALUES ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000200', '11111111-1111-1111-1111-111111111111', 23.00);

-- Expense 3: Khalid (User 1) paid for Fuel (30.00).
-- Total: 30.00
INSERT INTO public.expenses (id, group_id, creator_user_id, payer_user_id, title, total_amount, currency)
VALUES ('00000000-0000-0000-0000-000000000300', '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'ENOC Fuel', 30.00, 'USD');

INSERT INTO public.line_items (id, expense_id, description, amount, position)
VALUES ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000300', 'Petrol', 30.00, 1);

-- 50/50 split
INSERT INTO public.line_item_splits (line_item_id, expense_id, user_id, amount)
VALUES 
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000300', '11111111-1111-1111-1111-111111111111', 15.00),
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000300', '22222222-2222-2222-2222-222222222222', 15.00);

-- 6. Create Payment
-- Sara pays Khalid 10.00
INSERT INTO public.payments (from_user_id, to_user_id, group_id, amount, currency)
VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 10.00, 'USD');
