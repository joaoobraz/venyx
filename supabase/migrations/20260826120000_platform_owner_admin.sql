-- Fanlira: garante que o e-mail do proprietário tenha acesso administrativo.
-- Esta regra não concede admin por cliente: a promoção acontece no banco,
-- protegida pelas mesmas policies/RLS usadas pelo restante da plataforma.

CREATE OR REPLACE FUNCTION public.promote_platform_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(coalesce(NEW.email, '')) = 'joaobraz.ofc@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.promote_platform_owner() FROM PUBLIC;

DROP TRIGGER IF EXISTS promote_platform_owner_after_signup ON auth.users;
CREATE TRIGGER promote_platform_owner_after_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.promote_platform_owner();

-- Corrige a conta do proprietário caso ela já exista antes desta migration.
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE lower(email) = 'joaobraz.ofc@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

