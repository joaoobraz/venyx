CREATE POLICY "Criadora atualiza suas campanhas"
ON public.mass_dm_campaigns
FOR UPDATE
TO authenticated
USING (auth.uid() = creator_id);
