-- Restringir leitura de platform_settings ao admin
DROP POLICY IF EXISTS "Todos leem settings" ON public.platform_settings;

CREATE POLICY "Admin lê settings"
ON public.platform_settings
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- RPC pública para expor apenas a taxa da plataforma
CREATE OR REPLACE FUNCTION public.get_platform_fee_pct()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT platform_fee_pct FROM public.platform_settings WHERE id = 1
$$;

GRANT EXECUTE ON FUNCTION public.get_platform_fee_pct() TO anon, authenticated;

-- post_goals: respeitar acesso ao post
DROP POLICY IF EXISTS "Goals visíveis a todos" ON public.post_goals;

CREATE POLICY "Goals visíveis conforme acesso ao post"
ON public.post_goals
FOR SELECT
USING (public.can_view_post(post_id, auth.uid()));
