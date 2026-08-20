-- Repair legacy OAuth users that predate the profile trigger and make future
-- account provisioning idempotent. An authenticated account must always have
-- one profile and at least the subscriber role.

BEGIN;

CREATE OR REPLACE FUNCTION public.provision_user_profile(
  _user_id uuid,
  _email text,
  _metadata jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  base_username text;
  final_username text;
  suffix integer := 0;
BEGIN
  base_username := pg_catalog.lower(pg_catalog.regexp_replace(
    coalesce(
      _metadata->>'username',
      pg_catalog.split_part(_email, '@', 1),
      'user' || pg_catalog.substr(_user_id::text, 1, 8)
    ),
    '[^a-z0-9_]',
    '',
    'g'
  ));
  IF base_username IS NULL OR pg_catalog.length(base_username) < 3 THEN
    base_username := 'user' || pg_catalog.substr(_user_id::text, 1, 8);
  END IF;

  final_username := base_username;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    suffix := suffix + 1;
    final_username := base_username || suffix::text;
  END LOOP;

  INSERT INTO public.profiles (user_id, username, display_name)
  VALUES (
    _user_id,
    final_username,
    coalesce(
      _metadata->>'display_name',
      _metadata->>'full_name',
      _metadata->>'name',
      final_username
    )
  )
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'subscriber'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.provision_user_profile(NEW.id, NEW.email, NEW.raw_user_meta_data);

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.provision_user_profile(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_user_profile(uuid, text, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DO $$
DECLARE
  account record;
BEGIN
  FOR account IN
    SELECT user_row.*
    FROM auth.users AS user_row
    WHERE NOT EXISTS (
      SELECT 1 FROM public.profiles AS profile
      WHERE profile.user_id = user_row.id
    )
  LOOP
    PERFORM public.provision_user_profile(
      account.id,
      account.email,
      account.raw_user_meta_data
    );
  END LOOP;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
