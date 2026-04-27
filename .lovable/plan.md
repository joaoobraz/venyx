# Corrigir exposição pública de dados financeiros

## Problema
Duas tabelas estão com leitura pública desnecessária, expondo dados sensíveis:

1. **`platform_settings`** — policy `"Todos leem settings"` permite que `anon` e `authenticated` leiam taxa da plataforma (`platform_fee_pct`), dias de retenção (`hold_days`) e mínimo de saque. Configurações internas não devem ser públicas.
2. **`post_goals`** — policy `"Goals visíveis a todos"` (USING `true`) expõe metas financeiras (`target_cents`, `raised_cents`, `unlock_price_cents`) de **todos** os posts, mesmo de posts privados/PPV/subscribers que o usuário não tem acesso.

## Solução

### 1. `platform_settings` → apenas admin
- DROP policy `"Todos leem settings"`.
- CREATE policy SELECT apenas para `has_role(auth.uid(), 'admin')`.
- Criar função `public.get_platform_fee_pct()` (SECURITY DEFINER, STABLE) que retorna apenas o campo `platform_fee_pct` para qualquer authenticated. Isso permite o cálculo de payout no frontend/server sem expor a tabela inteira.
- Refatorar `src/routes/creator.wallet.tsx` (e qualquer outro lugar que faça `from('platform_settings').select('*')`) para chamar a RPC `get_platform_fee_pct` em vez de ler a tabela.

### 2. `post_goals` → respeitar acesso ao post
- DROP policy `"Goals visíveis a todos"`.
- CREATE policy SELECT com `USING (public.can_view_post(post_id, auth.uid()))` — assim a meta só aparece para quem pode ver o post (público, dono, assinante ativo, comprador PPV, ou meta já desbloqueada via `can_view_post`).

## Detalhes técnicos

**Migração SQL:**
```sql
-- platform_settings
DROP POLICY "Todos leem settings" ON public.platform_settings;
CREATE POLICY "Admin lê settings" ON public.platform_settings
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.get_platform_fee_pct()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT platform_fee_pct FROM public.platform_settings WHERE id = 1 $$;

-- post_goals
DROP POLICY "Goals visíveis a todos" ON public.post_goals;
CREATE POLICY "Goals visíveis conforme acesso ao post" ON public.post_goals
  FOR SELECT USING (public.can_view_post(post_id, auth.uid()));
```

**Refatoração de código:**
- Buscar usos de `platform_settings` com `rg "platform_settings"` e substituir leituras por `supabase.rpc('get_platform_fee_pct')`.
- Verificar componentes que mostram metas em posts (PostCard, feed, página do post) — como `can_view_post` já cobre o caso `visibility = 'goal'` (meta desbloqueada ou contribuinte), o comportamento público de exibir progresso de metas em posts goal continua funcionando.

## Validação
- Rodar `supabase--linter` após a migração.
- Confirmar que carteira da criadora (`/creator/wallet`) ainda calcula taxa corretamente.
- Confirmar que posts com meta pública continuam mostrando barra de progresso.
