-- Moderation logs (auditoria de uploads bloqueados)
CREATE TABLE public.moderation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  surface text NOT NULL, -- 'post' | 'story' | 'chat'
  category text NOT NULL, -- 'csam' | 'other'
  reason text,
  mime_type text,
  file_size_bytes integer,
  ai_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.moderation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin vê todos logs"
  ON public.moderation_logs FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Usuário vê seus logs"
  ON public.moderation_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Sistema/usuário insere log"
  ON public.moderation_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Creator onboarding checklist
CREATE TABLE public.creator_onboarding (
  user_id uuid PRIMARY KEY,
  has_avatar boolean NOT NULL DEFAULT false,
  has_cover boolean NOT NULL DEFAULT false,
  has_bio boolean NOT NULL DEFAULT false,
  has_price boolean NOT NULL DEFAULT false,
  has_first_post boolean NOT NULL DEFAULT false,
  has_shared_link boolean NOT NULL DEFAULT false,
  dismissed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.creator_onboarding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Criadora vê seu onboarding"
  ON public.creator_onboarding FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Criadora cria seu onboarding"
  ON public.creator_onboarding FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Criadora atualiza seu onboarding"
  ON public.creator_onboarding FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_creator_onboarding_updated
  BEFORE UPDATE ON public.creator_onboarding
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();