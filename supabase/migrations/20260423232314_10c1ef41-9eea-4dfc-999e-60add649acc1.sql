-- Adiciona valor 'goal' ao enum post_visibility
ALTER TYPE public.post_visibility ADD VALUE IF NOT EXISTS 'goal';

-- Tabela de metas
CREATE TABLE public.post_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL UNIQUE REFERENCES public.posts(id) ON DELETE CASCADE,
  target_cents integer NOT NULL CHECK (target_cents >= 100),
  raised_cents integer NOT NULL DEFAULT 0,
  unlock_price_cents integer NOT NULL CHECK (unlock_price_cents >= 100),
  is_unlocked boolean NOT NULL DEFAULT false,
  unlocked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.post_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Goals visíveis a todos" ON public.post_goals
  FOR SELECT USING (true);

CREATE POLICY "Criadora cria meta de seus posts" ON public.post_goals
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.creator_id = auth.uid()));

CREATE POLICY "Criadora atualiza meta de seus posts" ON public.post_goals
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.creator_id = auth.uid()));

CREATE POLICY "Criadora apaga meta de seus posts" ON public.post_goals
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.creator_id = auth.uid()));

CREATE TRIGGER trg_post_goals_updated_at
BEFORE UPDATE ON public.post_goals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de contribuições
CREATE TABLE public.post_goal_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents >= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

CREATE INDEX idx_pgc_post ON public.post_goal_contributions(post_id);
CREATE INDEX idx_pgc_user ON public.post_goal_contributions(user_id);

ALTER TABLE public.post_goal_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário vê próprias contribuições" ON public.post_goal_contributions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Criadora vê contribuições dos seus posts" ON public.post_goal_contributions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.creator_id = auth.uid()));

CREATE POLICY "Usuário cria sua contribuição" ON public.post_goal_contributions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Trigger: incrementa raised_cents e marca como desbloqueada quando atingir target
CREATE OR REPLACE FUNCTION public.handle_goal_contribution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  g RECORD;
  new_total integer;
BEGIN
  SELECT * INTO g FROM public.post_goals WHERE post_id = NEW.post_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Meta não encontrada para este post';
  END IF;

  new_total := g.raised_cents + NEW.amount_cents;

  UPDATE public.post_goals
  SET raised_cents = new_total,
      is_unlocked = (new_total >= target_cents),
      unlocked_at = CASE WHEN new_total >= target_cents AND NOT g.is_unlocked THEN now() ELSE g.unlocked_at END
  WHERE post_id = NEW.post_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_post_goal_contribution
AFTER INSERT ON public.post_goal_contributions
FOR EACH ROW EXECUTE FUNCTION public.handle_goal_contribution();