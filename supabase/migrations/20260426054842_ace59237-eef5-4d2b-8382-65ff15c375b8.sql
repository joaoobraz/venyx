-- =====================================================================
-- Endurecimento de RLS: bloquear inserções diretas em tabelas que
-- concedem acesso pago. Apenas o servidor (service role / supabaseAdmin)
-- pode inserir essas linhas após validar o pagamento.
-- =====================================================================

-- 1) subscriptions: remover INSERT do usuário
DROP POLICY IF EXISTS "Usuário cria sua assinatura" ON public.subscriptions;
DROP POLICY IF EXISTS "Usuario cria sua assinatura" ON public.subscriptions;

-- 2) ppv_unlocks: remover INSERT do usuário
DROP POLICY IF EXISTS "Usuário cria seu desbloqueio" ON public.ppv_unlocks;

-- 3) chat_ppv_unlocks: remover INSERT do usuário
DROP POLICY IF EXISTS "Usuário cria seu desbloqueio chat" ON public.chat_ppv_unlocks;

-- 4) post_goal_contributions: remover INSERT do usuário
DROP POLICY IF EXISTS "Usuário cria sua contribuição" ON public.post_goal_contributions;

-- (sem novas políticas de INSERT: service role bypassa RLS)

-- =====================================================================
-- 5) withdrawal_requests: restringir UPDATE do criador a apenas
--    cancelamento (status -> 'canceled') quando ainda 'pending'.
-- =====================================================================
DROP POLICY IF EXISTS "Criadora cancela seu saque" ON public.withdrawal_requests;

-- Função trigger: bloqueia mudança de campos sensíveis pelo criador
CREATE OR REPLACE FUNCTION public.protect_withdrawal_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins podem mudar tudo
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Criadora: só pode cancelar pendente, sem alterar valores/chave
  IF auth.uid() = OLD.creator_id THEN
    IF OLD.status <> 'pending' THEN
      RAISE EXCEPTION 'Saque já processado, não pode ser alterado';
    END IF;
    IF NEW.status <> 'canceled' THEN
      RAISE EXCEPTION 'Criadora só pode cancelar saques pendentes';
    END IF;
    IF NEW.amount_cents IS DISTINCT FROM OLD.amount_cents
       OR NEW.pix_key IS DISTINCT FROM OLD.pix_key
       OR NEW.pix_key_type IS DISTINCT FROM OLD.pix_key_type
       OR NEW.holder_name IS DISTINCT FROM OLD.holder_name
       OR NEW.holder_document IS DISTINCT FROM OLD.holder_document
       OR NEW.creator_id IS DISTINCT FROM OLD.creator_id THEN
      RAISE EXCEPTION 'Campos financeiros não podem ser alterados';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Não autorizado';
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_withdrawal_update ON public.withdrawal_requests;
CREATE TRIGGER trg_protect_withdrawal_update
BEFORE UPDATE ON public.withdrawal_requests
FOR EACH ROW
EXECUTE FUNCTION public.protect_withdrawal_update();

CREATE POLICY "Criadora cancela seu saque"
ON public.withdrawal_requests
FOR UPDATE
TO authenticated
USING (auth.uid() = creator_id AND status = 'pending')
WITH CHECK (auth.uid() = creator_id AND status = 'canceled');

-- Mantém a política de admin (já existe)

-- =====================================================================
-- 6) affiliate_referrals: remover INSERT direto do usuário
-- =====================================================================
DROP POLICY IF EXISTS "Usuário registra sua referência" ON public.affiliate_referrals;
-- Inserção agora só via server function com supabaseAdmin
