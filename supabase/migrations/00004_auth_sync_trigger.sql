-- ============================================================================
-- Migration: 00004_auth_sync_trigger
-- Description: Auth sync trigger — syncs auth.users inserts into public.users
-- Spec: SPEC-003 (Auth — Supabase Auth, Client Singleton, Auth Gate, Sign-In Screens)
-- Branch: feat/SPEC-003-auth
-- Date: 2026-04-11
-- ============================================================================
--
-- DOWN rollback:
--   DROP TRIGGER IF EXISTS trg_auth_sync_user ON auth.users;
--   DROP FUNCTION IF EXISTS public.fn_auth_sync_user();
--

CREATE OR REPLACE FUNCTION public.fn_auth_sync_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _display_name TEXT;
  _avatar_url   TEXT;
  _provider     TEXT;
BEGIN
  -- Derive display_name: full_name → name → email local part
  _display_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    SPLIT_PART(NEW.email, '@', 1)
  );

  -- Derive avatar_url: avatar_url → picture
  _avatar_url := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture'
  );

  -- Derive auth_provider: provider field → 'magic_link'
  _provider := COALESCE(
    NEW.raw_app_meta_data->>'provider',
    'magic_link'
  );

  -- Upsert: insert or update on duplicate id (idempotent multi-provider merge)
  INSERT INTO public.users (id, email, display_name, avatar_url, auth_provider)
  VALUES (NEW.id, NEW.email, _display_name, _avatar_url, _provider)
  ON CONFLICT (id) DO UPDATE SET
    display_name = COALESCE(public.users.display_name, EXCLUDED.display_name),
    avatar_url   = COALESCE(public.users.avatar_url,   EXCLUDED.avatar_url),
    updated_at   = now();

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auth_sync_user
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_auth_sync_user();
