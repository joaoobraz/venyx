-- =====================================================================
-- 2026-09-15 — Publicações e stories entram aprovados (sem fila manual)
--
-- Decisão do dono da plataforma: posts e stories ficam visíveis assim que
-- publicados, sem passar pela fila de moderação manual. Mensagens de chat
-- com mídia continuam em 'pending' (o texto puro já era aprovado).
--
-- ATENÇÃO: isso remove a checagem humana prévia de posts/stories. Reavaliar
-- antes do lançamento comercial, conforme o MVP_CHECKLIST.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.enforce_manual_moderation_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF TG_TABLE_NAME = 'chat_messages' THEN
      -- Chat: texto puro aprovado; mídia entra pendente de revisão.
      NEW.moderation_status := CASE WHEN NEW.media_path IS NULL THEN 'approved' ELSE 'pending' END;
    ELSE
      -- Posts e stories: aprovados automaticamente.
      NEW.moderation_status := 'approved';
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

NOTIFY pgrst, 'reload schema';
