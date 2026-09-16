-- This historical migration originally inserted shared-password demo accounts
-- and referenced a hard-coded user from the source Lovable project.
-- It is intentionally a no-op so clean staging and production databases never
-- receive unsafe demo identities or fail on a missing source-project user.
DO $$
BEGIN
  RAISE NOTICE 'Skipping legacy demo seed migration';
END
$$;
