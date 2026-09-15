-- =====================================================================
-- 2026-09-15 — Corrige o gatilho de moderação manual que impedia publicar
--
-- A versão anterior fazia:
--   IF TG_TABLE_NAME = 'chat_messages' AND NEW.media_path IS NULL THEN
-- O Postgres avalia a expressão inteira, então `NEW.media_path` era
-- resolvido mesmo quando o gatilho rodava em `posts`/`stories`, que não têm
-- essa coluna. Resultado: toda publicação de post e story feita por uma
-- criadora (role authenticated) falhava com
--   record "new" has no field "media_path" (42703)
-- desde 19/08/2026. Confirmado no primeiro teste real em 15/09/2026.
--
-- A correção usa IF aninhado: o PL/pgSQL só prepara o comando interno
-- quando ele é executado, então `NEW.media_path` nunca é resolvido fora do
-- chat. Também troca current_setting('request.jwt.claim.role') por
-- auth.role(), que é o que o resto do banco usa e funciona neste projeto.
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
    NEW.moderation_status := 'pending';
    -- Mensagem de chat só de texto não precisa de fila de moderação.
    IF TG_TABLE_NAME = 'chat_messages' THEN
      IF NEW.media_path IS NULL THEN
        NEW.moderation_status := 'approved';
      END IF;
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
