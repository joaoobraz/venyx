-- A pessoa pode escolher seu nome de usuário e alterá-lo novamente após 14 dias.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username_changed_at timestamptz;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_username_format_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_format_check
  CHECK (
    char_length(username) BETWEEN 3 AND 30
    AND username ~ '^[a-z0-9]+([._][a-z0-9]+)*$'
  ) NOT VALID;

CREATE OR REPLACE FUNCTION public.enforce_profile_username_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.username := lower(trim(NEW.username));

  IF NEW.username IS DISTINCT FROM OLD.username THEN
    IF char_length(NEW.username) NOT BETWEEN 3 AND 30
       OR NEW.username !~ '^[a-z0-9]+([._][a-z0-9]+)*$' THEN
      RAISE EXCEPTION 'USERNAME_INVALID' USING ERRCODE = '22023';
    END IF;

    IF auth.uid() = OLD.user_id THEN
      IF OLD.username_changed_at IS NOT NULL
         AND now() < OLD.username_changed_at + interval '14 days' THEN
        RAISE EXCEPTION 'USERNAME_CHANGE_COOLDOWN'
          USING ERRCODE = 'P0001',
                DETAIL = (OLD.username_changed_at + interval '14 days')::text;
      END IF;

      NEW.username_changed_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_profile_username_change ON public.profiles;
CREATE TRIGGER trg_enforce_profile_username_change
BEFORE UPDATE OF username ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_profile_username_change();
