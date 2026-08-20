-- The production project was created with automatic Data API exposure disabled.
-- RLS policies alone do not grant access, so restore only the SQL operations
-- that have an explicit policy for anon/authenticated. Server-only mutations
-- remain revoked below.

DO $$
DECLARE
  target_role text;
  policy_row record;
  privilege_list text;
BEGIN
  FOREACH target_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    FOR policy_row IN
      SELECT DISTINCT schemaname, tablename, cmd
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename <> 'profiles'
        AND (
          roles @> ARRAY['public']::name[]
          OR roles @> ARRAY[target_role]::name[]
        )
    LOOP
      privilege_list := CASE policy_row.cmd
        WHEN 'SELECT' THEN 'SELECT'
        WHEN 'INSERT' THEN 'INSERT'
        WHEN 'UPDATE' THEN 'UPDATE'
        WHEN 'DELETE' THEN 'DELETE'
        WHEN 'ALL' THEN 'SELECT, INSERT, UPDATE, DELETE'
        ELSE NULL
      END;

      IF privilege_list IS NOT NULL THEN
        EXECUTE format(
          'GRANT %s ON TABLE %I.%I TO %I',
          privilege_list,
          policy_row.schemaname,
          policy_row.tablename,
          target_role
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- profiles uses a public showcase view and column grants so internal fields do
-- not become readable just because the row itself is visible through RLS.
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (
  user_id, username, display_name, avatar_url, cover_url, bio,
  location, links, is_verified, subscription_price_cents,
  watermark_position, watermark_opacity, language, created_at
) ON public.profiles TO anon, authenticated;
GRANT SELECT (trial_days, trial_days_enabled) ON public.profiles TO authenticated;

REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (
  username, display_name, avatar_url, cover_url, bio, location, links,
  subscription_price_cents, watermark_position, watermark_opacity,
  language, trial_days, trial_days_enabled
) ON public.profiles TO authenticated;

GRANT SELECT ON public.profiles_public TO anon, authenticated;
GRANT SELECT ON public.creator_balances TO authenticated;

-- These mutations are intentionally server-only even if an older policy still
-- exists in the migration history.
REVOKE INSERT, UPDATE ON public.withdrawal_requests FROM authenticated;
REVOKE UPDATE ON public.platform_settings FROM authenticated;
REVOKE INSERT, UPDATE ON public.moderation_decisions FROM authenticated;
REVOKE INSERT ON public.coupon_redemptions FROM authenticated;
REVOKE INSERT, UPDATE ON public.creator_payout_keys FROM authenticated;
REVOKE UPDATE ON public.subscriptions FROM authenticated;

CREATE OR REPLACE FUNCTION public.get_my_profile_private()
RETURNS TABLE (
  id uuid,
  username_changed_at timestamptz,
  trial_days_enabled boolean,
  trial_days integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    profile.id,
    profile.username_changed_at,
    profile.trial_days_enabled,
    profile.trial_days
  FROM public.profiles AS profile
  WHERE profile.user_id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_my_profile_private() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_profile_private() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
