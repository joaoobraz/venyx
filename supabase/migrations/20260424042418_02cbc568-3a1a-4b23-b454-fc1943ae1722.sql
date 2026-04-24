-- Hardening da policy de UPDATE em public.subscriptions
-- Antes: USING (auth.uid() = subscriber_id) sem WITH CHECK -> permitia
-- que o assinante reativasse, mudasse creator_id/price/period_end.
-- Agora: só permite transição para 'canceled' e proíbe alterar campos sensíveis.

DROP POLICY IF EXISTS "Usuário cancela sua assinatura" ON public.subscriptions;

CREATE POLICY "Assinante só pode cancelar a própria assinatura"
ON public.subscriptions
FOR UPDATE
TO authenticated
USING (auth.uid() = subscriber_id)
WITH CHECK (
  auth.uid() = subscriber_id
  AND status = 'canceled'::subscription_status
);

-- Trigger de defesa em profundidade: bloqueia mudanças em campos imutáveis
-- mesmo que alguma policy futura seja afrouxada.
CREATE OR REPLACE FUNCTION public.protect_subscription_immutable_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.subscriber_id IS DISTINCT FROM OLD.subscriber_id
     OR NEW.creator_id   IS DISTINCT FROM OLD.creator_id
     OR NEW.price_cents  IS DISTINCT FROM OLD.price_cents
     OR NEW.created_at   IS DISTINCT FROM OLD.created_at THEN
    -- Permite ao service-role (sem auth.uid) sobrescrever quando necessário.
    IF auth.uid() IS NOT NULL THEN
      RAISE EXCEPTION 'Campos imutáveis da assinatura não podem ser alterados';
    END IF;
  END IF;

  -- Bloqueia reativação por usuário comum (canceled/expired -> active).
  IF auth.uid() IS NOT NULL
     AND OLD.status IN ('canceled'::subscription_status, 'expired'::subscription_status)
     AND NEW.status = 'active'::subscription_status THEN
    RAISE EXCEPTION 'Reativação de assinatura só pode ser feita pelo servidor';
  END IF;

  -- Bloqueia estender o período por usuário comum.
  IF auth.uid() IS NOT NULL
     AND NEW.current_period_end IS DISTINCT FROM OLD.current_period_end THEN
    RAISE EXCEPTION 'Apenas o servidor pode alterar o período da assinatura';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_subscription_immutable ON public.subscriptions;
CREATE TRIGGER trg_protect_subscription_immutable
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.protect_subscription_immutable_fields();