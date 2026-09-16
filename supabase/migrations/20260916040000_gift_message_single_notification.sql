-- Mimo pago gerava duas notificações para a criadora: "Você recebeu uma venda"
-- (liquidação) e "Nova mensagem" (mensagem automática de mimo no chat).
-- A mensagem de mimo no chat deixa de notificar; a venda já avisa.
CREATE OR REPLACE FUNCTION public.notify_chat_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  recipient_id uuid;
  actor_name text;
BEGIN
  IF NEW.moderation_status <> 'approved' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.moderation_status = 'approved' THEN RETURN NEW; END IF;
  -- Mensagem automática de mimo: a notificação de venda já cobre.
  IF NEW.message_kind = 'gift' THEN RETURN NEW; END IF;
  SELECT CASE WHEN thread.user_a = NEW.sender_id THEN thread.user_b ELSE thread.user_a END
  INTO recipient_id FROM public.chat_threads thread
  WHERE thread.id = NEW.thread_id AND NEW.sender_id IN (thread.user_a, thread.user_b);
  IF recipient_id IS NULL
    OR NOT public.notifications_allow_actor(recipient_id, NEW.sender_id)
    OR public.notification_target_is_muted(recipient_id, 'thread', NEW.thread_id)
  THEN RETURN NEW; END IF;
  actor_name := public.actor_username(NEW.sender_id);
  DELETE FROM public.notifications notification
  WHERE notification.user_id = recipient_id
    AND notification.type = 'chat_message'
    AND notification.read_at IS NULL
    AND notification.metadata @> jsonb_build_object('thread_id', NEW.thread_id::text);
  INSERT INTO public.notifications(user_id, type, title, body, link, metadata)
  VALUES (
    recipient_id, 'chat_message',
    'Nova mensagem de @' || actor_name,
    CASE WHEN NEW.body IS NOT NULL THEN left(NEW.body, 120) ELSE 'Mídia recebida' END,
    '/chat?thread=' || NEW.thread_id::text,
    jsonb_build_object('thread_id', NEW.thread_id::text, 'message_id', NEW.id::text,
      'actor_id', NEW.sender_id::text, 'actor_username', actor_name,
      'message_kind', NEW.message_kind)
  );
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_chat_message() FROM PUBLIC, anon, authenticated;
