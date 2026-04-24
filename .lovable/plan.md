

# Pacote Crescimento, Monetização & Segurança — Venyx

Vou implementar **9 features** em 3 grandes grupos. Tudo já preparado para o gateway de pagamento real (que conectaremos depois) — por enquanto as transações ficam registradas em `transactions` com `gateway = "mock"`, mantendo o padrão atual.

---

## 🚀 Crescimento & Retenção

### 1. Stories 24h
- Cada criadora posta foto/vídeo efêmero que expira em 24h.
- Aparece em uma **fileira no topo do feed** (avatares com anel gradiente roxo→dourado).
- Visualizador full-screen com auto-avanço, barra de progresso, swipe entre criadoras.
- Suporta **2 níveis**: público ou só assinantes (auto-libera para quem tem sub ativa).
- Limpeza automática via filtro `expires_at > now()` no `SELECT`.

### 2. Programa de Afiliados (com tag Embaixadora)
- Nova role/tag **`ambassador`** em `user_roles`. Só admin atribui.
- **Requisito**: ser `creator` + ter tag `ambassador` para poder gerar link.
- Página `/creator/affiliate`: mostra link único `venyx.app/r/{código}`, total de cliques, conversões, comissão acumulada.
- Tabela `affiliate_codes` (código único por user) e `affiliate_referrals` (cliente referido + status).
- Comissão padrão 10% da 1ª assinatura — registrada em `transactions` com `type = "affiliate_commission"`.
- Cookie `venyx_ref` de 30 dias salvo ao acessar `/r/:code`.

### 3. Trial / Cupons de Assinatura
- Criadora cria cupons em `/creator/coupons`: define **dias de trial** (1–30) **OU** **% desconto** (5–90%) e duração (em meses) + limite de usos.
- Gera link `venyx.app/c/{código}` que pré-aplica o cupom no checkout do perfil.
- Tabela `subscription_coupons` + `coupon_redemptions` (anti-reuso).
- Badge "🎁 Trial 7 dias grátis" aparece no botão Assinar quando link tem cupom válido.

---

## 💰 Monetização Extra

### 4. Tips (Gorjetas)
- Botão **💝 Enviar Gorjeta** já existe no PostCard (hoje sem ação) + adicionado no header do perfil + no chat.
- Modal com valores rápidos (R$ 5 / 10 / 25 / 50) + custom + mensagem opcional.
- Registra em `transactions` com `type = "tip"`. Notificação para a criadora.
- Posts mostram "🏆 Top fã desta semana" se o user tipou mais que outros nos últimos 7d (cálculo on-demand).

### 5. PPV no Chat (DM Paga)
- No chat, criadora pode anexar **mídia bloqueada com preço** (botão 🔒 ao lado do anexo).
- Nova tabela `chat_messages` (real, substituindo o mock atual) com `ppv_price_cents`, `media_path`, `is_unlocked_for_recipient`.
- Tabela `chat_ppv_unlocks` rastreia desbloqueios individuais.
- Auto-desbloqueio para assinantes ativos quando msg é `subscribers_only` (já existe no mock — vamos ligar real).
- Realtime via Supabase Channels.

### 6. Bundles de Assinatura
- Criadora cria bundles em `/creator/subscription-plans`: 1 mês (preço cheio), 3 meses (-10%), 6 meses (-20%), 12 meses (-30%).
- Tabela `subscription_plans` (creator_id, months, price_cents, discount_pct, is_active).
- No perfil, botão "Assinar" abre modal com as opções de bundle disponíveis.
- `subscriptions.current_period_end` calculado pelos meses do bundle.

---

## 🛡️ Confiança & Segurança

### 8. Watermark Dinâmico
- Server route `/api/watermark/$path` (server function TanStack) recebe path + user logado.
- Usa **Canvas API via WASM** (compatível com Worker — nada de `sharp`) para sobrepor `@username • venyx.app` em diagonal semi-transparente nas imagens.
- Vídeos: overlay HTML por cima do `<video>` com nome do viewer (rastreável via screenshot).
- Aplicado **automaticamente** em todo conteúdo PPV/sub desbloqueado.
- Cache no edge para evitar reprocessar.

### 9. DMCA / Takedown Self-Service
- Página `/creator/dmca` com formulário: URL onde vazou, descrição, prova (upload).
- Tabela `dmca_reports` (creator_id, leaked_url, evidence_path, status: pending/notified/resolved).
- Admin vê lista em `/admin/dmca`, marca como "notificação enviada" e gera **PDF formal de notificação DMCA** (template pré-pronto com dados da criadora e do conteúdo) baixável.
- Integração futura com email automático para hosts.

### 10. 2FA (Opcional, ativável pela criadora)
- Em `/settings/security`: botão "Ativar 2FA" usa `supabase.auth.mfa.enroll()` (TOTP).
- QR code para Google Authenticator / Authy.
- Códigos de backup gerados (8 códigos one-time).
- **Obrigatório para saques** quando ativado: ao solicitar saque na wallet, pede código TOTP.
- Badge "🛡️ Conta protegida" no perfil de quem ativou.

---

## 🗂️ Arquitetura Técnica

### Migrations (1 arquivo SQL consolidado)
```text
- ALTER TYPE app_role ADD VALUE 'ambassador'
- ALTER TYPE tx_type ADD VALUE 'tip', 'affiliate_commission', 'chat_ppv'
- TABLE stories (id, creator_id, media_path, mime_type, visibility, expires_at, views_count)
- TABLE story_views (story_id, viewer_id) UNIQUE
- TABLE affiliate_codes (user_id UNIQUE, code UNIQUE, commission_pct, total_clicks)
- TABLE affiliate_referrals (code, referred_user_id, converted_at, commission_cents)
- TABLE subscription_coupons (creator_id, code, trial_days, discount_pct, duration_months, max_uses, uses_count)
- TABLE coupon_redemptions (coupon_id, user_id) UNIQUE
- TABLE subscription_plans (creator_id, months, price_cents, discount_pct, is_active)
- TABLE chat_threads (id, user_a, user_b) UNIQUE pair
- TABLE chat_messages (thread_id, sender_id, body, media_path, ppv_price_cents, subscribers_only, created_at)
- TABLE chat_ppv_unlocks (message_id, user_id) UNIQUE
- TABLE dmca_reports (creator_id, leaked_url, evidence_path, status, admin_notes)
- TABLE security_settings (user_id, mfa_enabled, mfa_required_for_withdraw)
- RLS policies em todas as tabelas (criadora gerencia o seu, viewer só lê o que tem acesso)
- Trigger: ao desbloquear chat PPV, marcar como visto
- Trigger: ao criar transação tipo "subscription" com referral cookie, registra commission
```

### Novas rotas (TanStack file-based)
```text
src/routes/
  creator.affiliate.tsx       # painel afiliado
  creator.coupons.tsx         # gestão de cupons
  creator.subscription-plans.tsx  # bundles
  creator.dmca.tsx            # reportar vazamento
  admin.dmca.tsx              # painel admin DMCA
  settings.security.tsx       # 2FA
  r.$code.tsx                 # redirect afiliado (seta cookie + → /)
  c.$code.tsx                 # redirect cupom (seta cookie + → /)
  api/watermark.$.ts          # server route watermark on-the-fly
```

### Novos componentes
```text
src/components/
  StoriesBar.tsx              # fileira no topo do feed
  StoryViewer.tsx             # full-screen viewer
  TipModal.tsx                # gorjeta
  SubscribeModal.tsx          # bundles + cupom
  ChatComposer.tsx            # com PPV attach
  WatermarkedMedia.tsx        # wrapper que serve URL com watermark
```

### Mudanças em arquivos existentes
- `src/lib/auth.tsx`: adiciona `isAmbassador`, `mfaEnabled`
- `src/components/PostCard.tsx`: liga botão Tip ao TipModal
- `src/routes/feed.tsx`: monta `<StoriesBar />` no topo
- `src/routes/profile.$username.tsx`: substitui botão Assinar pelo SubscribeModal; mostra badge 🛡️ se 2FA on
- `src/routes/chat.tsx`: substitui mock por dados reais + composer com PPV
- `src/routes/creator.posts.tsx`: adiciona botão "Postar Story" ao lado de "Novo post"
- `src/routes/creator.wallet.tsx`: pede TOTP no saque se 2FA on
- `src/components/Sidebar.tsx`: adiciona links "Afiliado", "Cupons", "Planos", "DMCA" (visíveis condicionalmente)

### Gateway de Pagamento
- Mantenho `gateway = "mock"` em todas as transações novas, com `status = "paid"` direto (mesmo padrão atual).
- Estrutura pronta: quando ligar Stripe/Pix, basta um webhook que muda `status` de `pending` → `paid` e dispara o desbloqueio.

---

## 📋 Ordem de Entrega

1. **Migration SQL** (todas as tabelas + RLS) — base de tudo
2. **Tips + Bundles** (rápidos, alto ROI)
3. **Stories 24h** (visual, retenção)
4. **Cupons & Trial** (conversão)
5. **Afiliados + tag Embaixadora**
6. **Chat real + PPV no DM**
7. **Watermark dinâmico**
8. **DMCA self-service**
9. **2FA opcional + obrigatório no saque**

Tudo entregue em **uma única passada** após sua aprovação.

