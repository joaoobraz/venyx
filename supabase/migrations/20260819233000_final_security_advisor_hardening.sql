-- Final least-privilege pass after all MVP feature migrations.
-- PostgreSQL grants EXECUTE to PUBLIC by default for every new function, so
-- migrations created after 20260730194500 reopened dozens of SECURITY DEFINER
-- routines unintentionally.

BEGIN;

DO $$
DECLARE
  routine regprocedure;
BEGIN
  FOR routine IN
    SELECT procedure.oid::regprocedure
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.prosecdef
  LOOP
    EXECUTE pg_catalog.format(
      'REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      routine
    );
    EXECUTE pg_catalog.format(
      'GRANT EXECUTE ON FUNCTION %s TO service_role',
      routine
    );
  END LOOP;
END;
$$;

-- Audited authenticated helpers and RPCs used by RLS or application flows.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_age_verified(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_post(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_post_metadata(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_story_path(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.storage_path_to_post_id(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_feed_posts(uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_thread_messages_verified(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_mass_dm(
  public.mass_dm_segment,
  uuid,
  text,
  text,
  text,
  integer,
  timestamptz,
  uuid,
  integer,
  boolean
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_mass_dm_recipients(
  public.mass_dm_segment,
  uuid,
  integer,
  boolean
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mass_dm_campaign_revenue(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_platform_fee_pct() TO authenticated;
GRANT EXECUTE ON FUNCTION public.actor_username(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notifications_allow_actor(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notification_target_is_muted(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.users_are_blocked(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.creator_onboarding_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_my_subscription_cancellation(uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.undo_my_subscription_cancellation(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_account_paused(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_pinned_post(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_loyalty_reward(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.profile_state_code(uuid) TO authenticated;

-- These helpers intentionally expose only a boolean needed by public profile
-- discovery. Their implementations ignore caller-supplied viewer IDs unless
-- the caller is service_role.
GRANT EXECUTE ON FUNCTION public.is_account_paused(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_profile(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.creator_allows_viewer(uuid, uuid) TO anon, authenticated;

-- Public buckets already permit fetching an object by its exact public URL.
-- The broad SELECT policy was unnecessary and additionally allowed clients to
-- enumerate every gift image in the bucket.
DROP POLICY IF EXISTS "Imagens de produtos públicas" ON storage.objects;

COMMIT;

NOTIFY pgrst, 'reload schema';
