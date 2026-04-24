-- ============================================================
-- SPEC-003: auth.users → public.users sync trigger
-- ============================================================

-- Trigger function: sync new auth.users rows to public.users
CREATE OR REPLACE FUNCTION fn_auth_sync_user()
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
  -- Extract display name: prefer full_name from provider metadata,
  -- fall back to email local part
  _display_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    SPLIT_PART(NEW.email, '@', 1)
  );

  -- Extract avatar URL from provider metadata
  _avatar_url := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture'
  );

  -- Determine auth provider
  _provider := COALESCE(
    NEW.raw_app_meta_data->>'provider',
    'magic_link'
  );

  -- Upsert: INSERT on first sign-up, UPDATE on multi-provider merge
  INSERT INTO public.users (id, email, display_name, avatar_url, auth_provider)
  VALUES (NEW.id, NEW.email, _display_name, _avatar_url, _provider)
  ON CONFLICT (id) DO UPDATE SET
    display_name = COALESCE(EXCLUDED.display_name, users.display_name),
    avatar_url   = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
    updated_at   = now();

  RETURN NEW;
END;
$$;

-- Attach trigger to auth.users (fires after insert)
CREATE TRIGGER trg_auth_sync_user
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION fn_auth_sync_user();

-- DOWN
-- DROP TRIGGER IF EXISTS trg_auth_sync_user ON auth.users;
-- DROP FUNCTION IF EXISTS fn_auth_sync_user();
