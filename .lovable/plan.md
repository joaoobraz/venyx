## Visão geral

Trocar o sistema de pagamento "mock" do Venyx pela **NexusPag (Pix real)**:

- Conta única da plataforma (sua) na NexusPag
- **Sem usar split nativo** — controle 100% dentro do Venyx (você muda taxa/regra sem depender deles)
- **Ledger interno**: a cada pagamento confirmado, 85% do bruto vai pro saldo da criadora, o resto fica com a plataforma
- Saque Pix da criadora pelo Venyx (fase 1: você processa manual no painel da NexusPag)

---

## Como o usuário vai ver

### Fã pagando (PPV / Tip / Assinatura / Meta / Chat PPV)
1. Clica em "Comprar / Assinar / Enviar gorjeta"
2. Aparece um **modal Pix** com:
   - QR Code (imagem)
   - Botão "Copiar código Pix"
   - Valor + descrição
   - Cronômetro de expiração (30 min)
   - Status ao vivo: "Aguardando pagamento..." → "Pagamento confirmado ✅"
3. Quando paga, o conteúdo libera/assinatura ativa **automaticamente** (via webhook + realtime)
4. Se fechar o modal antes de pagar, a cobrança fica salva — pode retomar em "Notificações" ou em `/pagamento/<id>`

### Criadora (carteira)
- `creator.wallet.tsx` mostra **saldo real** (`available_cents`)
- Histórico real de vendas (PPV, tip, assinatura, chat PPV)
- Botão "Sacar via Pix" → escolhe valor + chave Pix → cria solicitação `withdrawal pending`
- Você (admin) vê em nova tela `admin.withdrawals.tsx`, faz o Pix manual no painel NexusPag, marca como pago no Venyx

---

## Como fica a matemática (exemplo R$ 100,00)

| Item | Valor |
|---|---|
| Fã paga | R$ 100,00 |
| Taxa NexusPag (2%) | R$ 2,00 |
| Cai na sua conta NexusPag | R$ 98,00 |
| **Vai pra carteira da criadora (85% do bruto)** | **R$ 85,00** |
| **Sobra pra plataforma (você)** | **R$ 13,00** |

A taxa Pix de 2% é absorvida pela plataforma (você). Modelo sempre recebe 85% redondinho do que o fã pagou — fácil de comunicar pra ela.

Tudo configurável em `platform_settings` (mexe sem deploy):
- `creator_share_pct = 85`
- `gateway_fee_pct = 2` (informativo, pra relatório)
- `withdrawal_min_cents = 5000` (R$ 50)

---

## Mudanças no banco

### 1. Novas colunas em `transactions`
- `gateway_status` text — `pending | paid | expired | cancelled`
- `gateway_charge_id` text — UUID/txid na NexusPag
- `gateway_qr_code` text — pix copia-e-cola
- `gateway_qr_image` text — base64 da imagem
- `gateway_expires_at` timestamptz
- `paid_at` timestamptz
- `gateway_payer_name` text
- `gateway_payer_document` text (mascarado)
- `creator_net_cents` integer — 85% do bruto
- `platform_net_cents` integer — restante após taxa NexusPag
- Índice em `gateway_charge_id` e `(payer_id, status)`

### 2. Nova tabela `creator_balances`
```text
creator_id uuid PK
available_cents integer    -- pode sacar
pending_cents integer      -- reserva (chargeback futuro)
total_earned_cents integer
total_withdrawn_cents integer
updated_at timestamptz
```
Trigger: quando `transactions` vira `paid` e `type IN ('ppv','tip','subscription','chat_ppv','goal')`, soma `creator_net_cents` em `available_cents`.

### 3. Nova tabela `withdrawal_requests`
```text
id uuid PK
creator_id uuid
amount_cents integer
pix_key text
pix_key_type text       -- 'cpf' | 'email' | 'phone' | 'random'
status text             -- 'pending' | 'processing' | 'paid' | 'rejected'
admin_note text
created_at, processed_at
```
RLS: criadora vê/cria as próprias, admin vê/processa todas. Ao criar, debita `available_cents` na hora. Se rejeitada, devolve.

### 4. Nova tabela `webhook_events` (idempotência)
```text
id uuid PK
provider text           -- 'nexuspag'
event_type text         -- 'payment.confirmed'
external_ref text       -- transaction_id da NexusPag
payload jsonb           -- bruto pra auditoria
processed_at timestamptz
UNIQUE (provider, external_ref, event_type)
```
Garante que receber o mesmo webhook 2x não credita 2x.

### 5. Nova tabela `platform_settings`
Key/value, um row por chave. Você muda a regra sem deploy.

---

## Mudanças no código

### Novos arquivos
- `src/server/nexuspag.server.ts` — cliente HTTP:
  - `createPixCharge({ amountCents, description, externalId, expirationSec, webhookUrl })`
  - `getPixStatus(idOrExternal)`
- `src/routes/api.public.nexuspag-webhook.$token.tsx` — server route que recebe POST do webhook (token secreto no path)
- `src/components/PixCheckoutModal.tsx` — modal universal (QR + copia-cola + status ao vivo)
- `src/hooks/usePixCharge.ts` — cria cobrança + assina realtime na transaction pra detectar pagamento
- `src/routes/admin.withdrawals.tsx` — admin processa saques

### Arquivos modificados
- `src/server/payments.functions.ts` — todas as 5 funções (`unlockPpvServer`, `tipServer`, `subscribeServer`, `contributeGoalServer`, `unlockChatPpvServer`):
  - **Antes:** validava mock e marcava `paid`
  - **Depois:** cria `transactions` com `status='pending'`, chama `createPixCharge` (passando `external_id = transaction.id` e `webhook_url`), retorna QR pro frontend. **Não libera nada ainda.**
- `src/components/TipModal.tsx`, `SubscribeModal.tsx`, `PostCard.tsx` (PPV), `chat.tsx` (PPV msg), `feed.tsx` (meta) — trocam o "click → instantâneo" pelo `PixCheckoutModal`
- `src/routes/creator.wallet.tsx` — saldo real do `creator_balances` + histórico real + botão de saque
- `src/routes/settings.profile.tsx` — campo "Chave Pix para saque"
- `src/routes/notifications.tsx` — adiciona "Pagamento confirmado", "Saque processado/rejeitado"

### Webhook (fluxo)
```text
NexusPag → POST /api/public/nexuspag-webhook/<TOKEN_SECRETO>
  ├── Valida token do path (senão 401)
  ├── Verifica idempotência em webhook_events (UNIQUE)
  ├── Acha transactions por gateway_charge_id
  ├── Confirma com GET /api/pix/{id} na NexusPag (anti-spoof)
  ├── Em transação atômica:
  │   ├── transactions.status = 'paid', paid_at = now()
  │   ├── Libera conteúdo (ppv_unlocks, subscriptions ativa, post_goal_contributions, chat_ppv_unlocks)
  │   └── Trigger credita creator_balances.available_cents += creator_net_cents (85%)
  └── Marca webhook_events.processed_at
```

---

## Segurança do webhook

A doc da NexusPag **não fala em assinatura HMAC**. Mitigação sem depender deles:

1. ✅ URL com **path secreto** de 32 chars (`/api/public/nexuspag-webhook/<token>`) guardado em secret
2. ✅ Após receber webhook, **sempre fazer `GET /api/pix/{id}`** na NexusPag pra confirmar (anti-spoof — mesmo que alguém adivinhe o token, não consegue forjar pagamento)
3. ✅ Idempotência via UNIQUE em `webhook_events`
4. ✅ Se `gateway_charge_id` não bate com transação nossa → ignora silenciosamente

---

## Decisões já tomadas (com base no que você falou)

- ✅ Taxa NexusPag: **2%**
- ✅ Criadora: **85% sobre o bruto**, sempre
- ✅ Saque: **manual** (você processa no painel da NexusPag) — fase 1
- ✅ KYC obrigatório pra sacar (já existe trigger `enforce_kyc_for_withdrawal`)

## Perguntas finais antes de eu começar

1. ✅ **Já rotacionou a chave da NexusPag** que apareceu no chat? (sim/não)
2. 💰 **Valor mínimo de saque: R$ 50** tá bom? (ou prefere outro)
3. ⏱️ **Tempo de expiração do QR Code: 30 minutos** tá bom? (ou prefere mais curto/longo)

---

## Detalhes técnicos

- **Secrets a adicionar (via cofre Lovable, não no chat):**
  - `NEXUSPAG_API_KEY` — a nova chave (após rotação)
  - `NEXUSPAG_WEBHOOK_PATH_TOKEN` — string aleatória 32 chars (eu gero pra você)
- **URL do webhook** que vai em cada `createPixCharge`:
  `https://private-pleasures-portal.lovable.app/api/public/nexuspag-webhook/<TOKEN>`
- **Realtime:** habilitar `supabase_realtime` na tabela `transactions` pra UI fechar o modal sozinha quando webhook marca `paid`
- **Polling backup:** se realtime falhar, hook chama `getPixStatus` a cada 5s (via server function nossa, não direto do browser)
- **Expiração:** pgcron a cada 5min marca como `expired` os pendings vencidos

---

## Ordem de execução

1. Migração SQL (colunas novas + 4 tabelas + triggers + realtime)
2. `nexuspag.server.ts`
3. Pedir 2 secrets pelo cofre
4. Webhook route + verificação anti-spoof
5. Refatorar `payments.functions.ts` (5 funções)
6. `PixCheckoutModal` + `usePixCharge`
7. Plugar nos 5 fluxos (PPV, tip, sub, meta, chat PPV)
8. `creator.wallet.tsx` real + chave Pix em `settings.profile.tsx`
9. `admin.withdrawals.tsx`
10. Teste com R$ 1,00

Aprovou? Manda os 3 sins/respostas que eu já parto pra implementação.