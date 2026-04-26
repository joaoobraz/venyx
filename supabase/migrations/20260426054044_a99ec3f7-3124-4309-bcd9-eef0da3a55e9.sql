
CREATE POLICY "Criadora cria seu saque"
ON public.withdrawal_requests
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = creator_id AND has_role(auth.uid(), 'creator'::app_role));

CREATE POLICY "Criadora cancela seu saque"
ON public.withdrawal_requests
FOR UPDATE
TO authenticated
USING (auth.uid() = creator_id)
WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Admin atualiza saques"
ON public.withdrawal_requests
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Criadora vê desbloqueios das suas mensagens"
ON public.chat_ppv_unlocks
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_messages m
    WHERE m.id = chat_ppv_unlocks.message_id
      AND m.sender_id = auth.uid()
  )
);

CREATE POLICY "Auditoria: usuário grava própria entrada"
ON public.admin_access_audit
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
