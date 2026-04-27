
REVOKE EXECUTE ON FUNCTION public.start_creator_trial(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.start_creator_trial(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.award_loyalty_points(uuid, uuid, int, text, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.award_loyalty_points(uuid, uuid, int, text, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.mass_dm_campaign_revenue(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.mass_dm_campaign_revenue(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.calc_loyalty_tier(_points int)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _points >= 5000 THEN 'diamond'
    WHEN _points >= 2000 THEN 'gold'
    WHEN _points >= 500  THEN 'silver'
    ELSE 'bronze'
  END;
$$;
