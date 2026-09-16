-- Repair the staging deployment of award_loyalty_points. The prior migration
-- qualified GREATEST as a regular pg_catalog function, but PostgreSQL treats it
-- as special SQL syntax.
CREATE OR REPLACE FUNCTION public.award_loyalty_points(
  _user_id uuid,
  _creator_id uuid,
  _delta integer,
  _reason text,
  _ref_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF _user_id IS NULL
     OR _creator_id IS NULL
     OR _user_id = _creator_id
     OR _delta = 0 THEN
    RETURN;
  END IF;

  IF _ref_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.loyalty_ledger
    WHERE user_id = _user_id
      AND creator_id = _creator_id
      AND reason = _reason
      AND ref_id = _ref_id
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.loyalty_ledger (
    user_id,
    creator_id,
    points_delta,
    reason,
    ref_id
  )
  VALUES (_user_id, _creator_id, _delta, _reason, _ref_id);

  INSERT INTO public.loyalty_points (
    user_id,
    creator_id,
    points,
    tier
  )
  VALUES (
    _user_id,
    _creator_id,
    CASE WHEN _delta > 0 THEN _delta ELSE 0 END,
    public.calc_loyalty_tier(
      CASE WHEN _delta > 0 THEN _delta ELSE 0 END
    )
  )
  ON CONFLICT (user_id, creator_id) DO UPDATE
    SET points = CASE
          WHEN public.loyalty_points.points + _delta > 0
            THEN public.loyalty_points.points + _delta
          ELSE 0
        END,
        tier = public.calc_loyalty_tier(
          CASE
            WHEN public.loyalty_points.points + _delta > 0
              THEN public.loyalty_points.points + _delta
            ELSE 0
          END
        ),
        updated_at = pg_catalog.now();
END;
$$;

REVOKE ALL ON FUNCTION public.award_loyalty_points(
  uuid,
  uuid,
  integer,
  text,
  uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_loyalty_points(
  uuid,
  uuid,
  integer,
  text,
  uuid
) TO service_role;
