-- =====================================================================
-- 2026-09-15 — Chave liga/desliga da moderação manual de posts/stories
--
-- Quando manual_moderation_enabled = true, posts e stories entram 'pending'
-- e só aparecem após aprovação de um admin. Quando false, entram aprovados
-- (modo atual de teste/demo). Mídia de chat continua sempre pendente.
--
-- Padrão false para não mudar o comportamento atual; o admin liga antes de
-- abrir ao público pela tela Administrador → Moderação.
-- =====================================================================

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS manual_moderation_enabled boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.enforce_manual_moderation_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _manual boolean;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF TG_TABLE_NAME = 'chat_messages' THEN
      -- Chat: texto puro aprovado; mídia sempre pendente.
      NEW.moderation_status := CASE WHEN NEW.media_path IS NULL THEN 'approved' ELSE 'pending' END;
    ELSE
      SELECT manual_moderation_enabled INTO _manual FROM public.platform_settings WHERE id = 1;
      NEW.moderation_status := CASE WHEN COALESCE(_manual, false) THEN 'pending' ELSE 'approved' END;
    END IF;
    NEW.moderated_by := NULL;
    NEW.moderated_at := NULL;
    NEW.moderation_note := NULL;
    RETURN NEW;
  END IF;

  IF NEW.moderation_status IS DISTINCT FROM OLD.moderation_status THEN
    RAISE EXCEPTION 'FANLIRA_MODERATION_STATUS_SERVER_ONLY' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_manual_moderation_submission()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_manual_moderation_submission()
  TO service_role;

-- Leitura pública do estado (para o painel admin exibir a chave).
CREATE OR REPLACE FUNCTION public.get_manual_moderation_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE((SELECT manual_moderation_enabled FROM public.platform_settings WHERE id = 1), false);
$$;

REVOKE ALL ON FUNCTION public.get_manual_moderation_enabled() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_manual_moderation_enabled() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
