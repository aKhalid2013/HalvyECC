BEGIN;
SELECT plan(13);

-- ============================================================================
-- SPEC-003 TASK-1: Auth Sync Trigger Tests
-- Tests fn_auth_sync_user() and trg_auth_sync_user
-- ============================================================================

-- 1. Verify function exists in public schema
SELECT has_function(
  'public',
  'fn_auth_sync_user',
  'fn_auth_sync_user function should exist in public schema'
);

-- 2. Verify trigger exists on auth.users
SELECT has_trigger(
  'auth',
  'users',
  'trg_auth_sync_user',
  'trg_auth_sync_user trigger should exist on auth.users'
);

-- 3. Verify function is SECURITY DEFINER
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname  = 'fn_auth_sync_user'
      AND p.prosecdef = true
  ),
  'fn_auth_sync_user should be SECURITY DEFINER'
);

-- 4. Verify trigger fires AFTER INSERT on auth.users
SELECT ok(
  EXISTS (
    SELECT 1
    FROM information_schema.triggers
    WHERE event_object_schema = 'auth'
      AND event_object_table  = 'users'
      AND trigger_name        = 'trg_auth_sync_user'
      AND action_timing       = 'AFTER'
      AND event_manipulation  = 'INSERT'
  ),
  'trg_auth_sync_user should fire AFTER INSERT on auth.users'
);

-- 5. Verify trigger is FOR EACH ROW
SELECT ok(
  EXISTS (
    SELECT 1
    FROM information_schema.triggers
    WHERE event_object_schema = 'auth'
      AND event_object_table  = 'users'
      AND trigger_name        = 'trg_auth_sync_user'
      AND action_orientation  = 'ROW'
  ),
  'trg_auth_sync_user should be FOR EACH ROW'
);

-- ============================================================================
-- Behavioral Tests: Insert into auth.users → public.users sync
-- We simulate the trigger by calling fn_auth_sync_user directly via a fake
-- auth.users row, using pg_catalog to call trigger function if needed.
-- Instead, we test behavior by inserting into auth.users directly.
-- ============================================================================

-- 6. Test: inserting auth user with full_name syncs display_name correctly
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  raw_user_meta_data,
  raw_app_meta_data,
  created_at,
  updated_at,
  aud,
  role
) VALUES (
  'aaaa0001-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'fullname@example.com',
  '',
  '{"full_name": "Full Name User", "avatar_url": "https://example.com/avatar.png"}'::jsonb,
  '{"provider": "google"}'::jsonb,
  now(),
  now(),
  'authenticated',
  'authenticated'
);

SELECT results_eq(
  $$SELECT display_name FROM public.users WHERE id = 'aaaa0001-0000-0000-0000-000000000001'$$,
  ARRAY['Full Name User'],
  'display_name should be set from raw_user_meta_data full_name'
);

-- 7. Test: avatar_url synced correctly
SELECT results_eq(
  $$SELECT avatar_url FROM public.users WHERE id = 'aaaa0001-0000-0000-0000-000000000001'$$,
  ARRAY['https://example.com/avatar.png'],
  'avatar_url should be set from raw_user_meta_data avatar_url'
);

-- 8. Test: auth_provider set from raw_app_meta_data provider
SELECT results_eq(
  $$SELECT auth_provider FROM public.users WHERE id = 'aaaa0001-0000-0000-0000-000000000001'$$,
  ARRAY['google'],
  'auth_provider should be set from raw_app_meta_data provider'
);

-- 9. Test: fallback to 'name' when full_name absent
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password,
  raw_user_meta_data, raw_app_meta_data,
  created_at, updated_at, aud, role
) VALUES (
  'aaaa0002-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'nameonly@example.com',
  '',
  '{"name": "Name Only User"}'::jsonb,
  '{}'::jsonb,
  now(), now(), 'authenticated', 'authenticated'
);

SELECT results_eq(
  $$SELECT display_name FROM public.users WHERE id = 'aaaa0002-0000-0000-0000-000000000002'$$,
  ARRAY['Name Only User'],
  'display_name should fall back to name when full_name is absent'
);

-- 10. Test: fallback to email local part when no name metadata
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password,
  raw_user_meta_data, raw_app_meta_data,
  created_at, updated_at, aud, role
) VALUES (
  'aaaa0003-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000000',
  'localpart@example.com',
  '',
  '{}'::jsonb,
  '{}'::jsonb,
  now(), now(), 'authenticated', 'authenticated'
);

SELECT results_eq(
  $$SELECT display_name FROM public.users WHERE id = 'aaaa0003-0000-0000-0000-000000000003'$$,
  ARRAY['localpart'],
  'display_name should fall back to email local part when no name metadata'
);

-- 11. Test: auth_provider defaults to magic_link when provider absent
SELECT results_eq(
  $$SELECT auth_provider FROM public.users WHERE id = 'aaaa0003-0000-0000-0000-000000000003'$$,
  ARRAY['magic_link'],
  'auth_provider should default to magic_link when provider absent'
);

-- 12. Test: ON CONFLICT (id) DO UPDATE — idempotent upsert preserves good display_name
-- Insert a public.users row directly first (as if user pre-exists)
INSERT INTO public.users (id, email, display_name, auth_provider)
VALUES (
  'aaaa0004-0000-0000-0000-000000000004',
  'conflict@example.com',
  'Pre-existing Name',
  'google'
);

-- Now insert auth.users with a null/empty display_name scenario
-- (meta has no names, so trigger would produce email local part)
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password,
  raw_user_meta_data, raw_app_meta_data,
  created_at, updated_at, aud, role
) VALUES (
  'aaaa0004-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000000',
  'conflict@example.com',
  '',
  '{}'::jsonb,
  '{"provider": "google"}'::jsonb,
  now(), now(), 'authenticated', 'authenticated'
);

-- COALESCE on UPDATE should keep 'Pre-existing Name', not overwrite with 'conflict'
SELECT results_eq(
  $$SELECT display_name FROM public.users WHERE id = 'aaaa0004-0000-0000-0000-000000000004'$$,
  ARRAY['Pre-existing Name'],
  'ON CONFLICT update should not overwrite good display_name with email local part'
);

-- 13. Test: avatar_url fallback to 'picture' key
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password,
  raw_user_meta_data, raw_app_meta_data,
  created_at, updated_at, aud, role
) VALUES (
  'aaaa0005-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-000000000000',
  'picture@example.com',
  '',
  '{"full_name": "Picture User", "picture": "https://example.com/picture.png"}'::jsonb,
  '{}'::jsonb,
  now(), now(), 'authenticated', 'authenticated'
);

SELECT results_eq(
  $$SELECT avatar_url FROM public.users WHERE id = 'aaaa0005-0000-0000-0000-000000000005'$$,
  ARRAY['https://example.com/picture.png'],
  'avatar_url should fall back to picture key when avatar_url absent'
);

SELECT * FROM finish();
ROLLBACK;
