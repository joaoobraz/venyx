
# Próximas 5 features

Resumo do que já existe (não vou refazer):
- **Mass DM**: já há `mass_dm_campaigns` + `mass_dm_jobs` + RPC `enqueue_mass_dm` + página `/creator/mailing`. Já tem campo `ppv_price_cents` na campanha e no job. Falta UI clara de "DM em massa **paga**" + tracking de receita por campanha.
- **Bundles de assinatura**: já há `subscription_plans` (1/3/6/12 meses com desconto). Falta exibir os bundles dentro do `SubscribeModal` com destaque de economia.
- **Trial grátis**: já há `subscription_coupons.trial_days` (cupom de trial). Falta um trial **nativo** configurável pela criadora (sem precisar de cupom) e bloqueio anti-abuso (1 trial por usuário/criadora).
- **Wishlist** e **Loyalty**: não existem.

---

## 1. Mensagens em massa pagas (mass DM com PPV) — polish + receita

Backend já suporta. Vou:
- Na página `/creator/mailing`, deixar o **PPV opt-in destacado** (toggle "🔒 Mensagem paga" com slider de preço sugerido R$5/10/20/50).
- Mostrar preview do que o assinante verá (mídia borrada + CTA "Desbloquear por R$ X").
- Adicionar coluna **"Receita gerada"** na lista de campanhas (soma de `chat_ppv_unlocks` joinado por `campaign_id` via mensagens criadas).
- Migração leve: índice em `chat_messages(campaign_id)` + view `mass_dm_campaign_revenue` agregando unlocks por campanha.

## 2. Wishlist (lista de desejos)

Permite assinante "favoritar" criadora ou post PPV pra receber notificação quando entrar em promoção / for desbloqueado em mass DM.

- Nova tabela `wishlists`: `id, user_id, target_type ('creator' | 'post'), target_id, created_at`. RLS: dono lê/escreve o seu; criadora vê quem favoritou ela/seus posts (agregado).
- Botão de coração/bookmark no `PostCard` (PPV) e botão "Adicionar à wishlist" no perfil da criadora.
- Página `/wishlist` listando criadoras e posts salvos.
- Trigger: quando criadora dispara mass DM com `tag = wishlist`, o segmento "Quem te favoritou" aparece como filtro novo em `/creator/mailing` (junta com a UI já existente de segmentos).
- Dashboard da criadora: contador "X pessoas adicionaram você à wishlist" em `/creator/analytics`.

## 3. Bundles de assinatura (destaque no checkout)

Backend pronto (`subscription_plans`). Falta UX:
- Reescrever `SubscribeModal` pra carregar **todos os planos ativos** da criadora e mostrar cards lado a lado: 1m / 3m / 6m / 12m com preço/mês, total, % de desconto, badge "MAIS ESCOLHIDO" no plano com mais vendas.
- Plano selecionado por padrão = melhor custo-benefício (maior desconto > 0).
- Após escolha, segue o fluxo normal de checkout PIX, passando `months` e `plan_id` pra `checkout.functions.ts`.
- Na criação de assinatura, gravar `plan_id` e `months` no registro de `subscriptions` (migração: adicionar colunas se não existirem) pra `period_end = now + months`.

## 4. Trial grátis de X dias (nativo)

Hoje só existe via cupom. Quero trial sem fricção:
- Migração: adicionar `trial_days_enabled boolean default false` e `trial_days int default 0` em `profiles` (ou criar tabela `creator_trial_settings` se preferir não poluir profiles — vou usar `profiles` por simplicidade).
- Nova tabela `subscription_trials_used`: `(user_id, creator_id, used_at)` com PK composta. Garante 1 trial por par.
- UI em `/settings/profile` (aba criadora): toggle "Oferecer trial grátis" + input de dias (1–14, default 3).
- No `SubscribeModal`, se a criadora tem trial ativo E o usuário ainda não usou, mostra botão **"Começar 3 dias grátis"** acima dos bundles. Cria assinatura com `status = active`, `period_end = now + trial_days`, `is_trial = true`, sem cobrança.
- Migração: adicionar `is_trial boolean default false` em `subscriptions`.
- Trigger / cron diário: ao expirar trial, marca `status = expired` (já deve existir lógica de expiração; só precisa cobrir o caso trial).

## 5. Programa de fidelidade (gamificação)

Sistema de **pontos + tiers** que recompensa engajamento real (gastar dinheiro), não atividades vazias.

- Tabela `loyalty_points`: `user_id, creator_id, points int, tier text, updated_at`. PK composta `(user_id, creator_id)` — pontos são **por criadora**, não globais (faz mais sentido no modelo).
- Tabela `loyalty_ledger`: histórico `(id, user_id, creator_id, points_delta, reason, ref_id, created_at)` pra transparência.
- Regras de pontuação (configuráveis por criadora numa segunda iteração; v1 hardcoded):
  - 1 ponto por R$1 gasto (assinatura, PPV post, PPV chat, gorjeta).
  - +50 pontos por mês completo de assinatura ativa.
  - +10 pontos por comentário (limitado a 3/dia pra evitar spam).
- Tiers (badges visíveis no chat/comentários):
  - 🥉 Bronze (0–500), 🥈 Prata (500–2000), 🥇 Ouro (2000–5000), 💎 Diamante (5000+).
- Benefícios automáticos (v1 simbólicos, v2 desbloqueia recompensas reais):
  - Badge ao lado do nome no chat e nos comentários.
  - Tier Diamante = entra automático em segmento "VIP" do mass DM.
- Trigger SQL: ao inserir em `pix_charges` com status `paid` / `ppv_unlocks` / `chat_ppv_unlocks` / `subscriptions` ativa → calcula delta e insere em `loyalty_ledger` + upsert `loyalty_points`.
- Página `/loyalty` (assinante): lista criadoras que segue, pontos atuais, tier, próxima recompensa.
- Card no perfil da criadora: "Seus pontos com @fulana: 1.230 (Prata)".
- Aba `/creator/loyalty` pra criadora ver top fãs por pontos (já é praticamente um VIP leaderboard que dobra como ferramenta de retenção).

---

## Detalhes técnicos

**Migrações** (uma por feature, em ordem):
1. Wishlist: `wishlists` + RLS + index `(user_id, target_type, target_id)`.
2. Trial: `profiles.trial_days_enabled/trial_days`, `subscriptions.is_trial`, `subscription_trials_used` + RLS.
3. Loyalty: `loyalty_points`, `loyalty_ledger` + RLS + função `award_points(_user, _creator, _delta, _reason, _ref)` + triggers em `pix_charges` (após paid), `ppv_unlocks`, `chat_ppv_unlocks`, `subscriptions`.
4. Mass DM revenue: índice + view materializada leve (ou função `mass_dm_campaign_stats(creator_id)` retornando linhas com receita).

**Novas rotas/arquivos**:
- `src/routes/wishlist.tsx`
- `src/routes/loyalty.tsx`
- `src/routes/creator.loyalty.tsx`
- `src/components/WishlistButton.tsx`
- `src/components/LoyaltyBadge.tsx`
- `src/components/BundlePicker.tsx` (usado dentro do `SubscribeModal`)
- `src/components/TrialBanner.tsx` (usado no `SubscribeModal`)

**Edits**:
- `SubscribeModal.tsx` → BundlePicker + TrialBanner.
- `creator.mailing.tsx` → destaque PPV + coluna receita + segmento "wishlist".
- `settings.profile.tsx` → toggle de trial.
- `PostCard.tsx` + `profile.$username.tsx` → WishlistButton + LoyaltyBadge.
- `chat.tsx` → LoyaltyBadge ao lado do nome.
- `Sidebar.tsx` → links pra /wishlist e /loyalty.

**Server functions**:
- `src/server/wishlist.functions.ts` (toggle, list).
- `src/server/loyalty.functions.ts` (get points, ledger, top fãs).
- `src/server/trial.functions.ts` (start trial, validações).

**Sem novas dependências.** Tudo usa o stack atual (Supabase RLS, RPC, TanStack Start).

Vou implementar nessa ordem: Bundles (mais rápido, já tem backend) → Trial → Wishlist → Mass DM polish → Loyalty (mais denso). Tudo na mesma rodada de build.
