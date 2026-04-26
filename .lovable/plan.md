# Correções de Segurança — Scan do Backend

O scan automatizado encontrou **9 problemas**: **2 críticos** (fraude de pagamento) e **7 avisos** (RLS frouxa, CSP, padrões inconsistentes).

## 🔴 CRÍTICOS — corrigir antes de publicar

### 1. Token de pagamento "mock" aceito em produção
`src/server/payments.functions.ts` → função `validateGatewayToken` aceita qualquer string que comece com `mock_` como prova de pagamento. Isso afeta:
- `unlockPpvServer`, `tipServer`, `contributeGoalServer`, `subscribeServer`, `unlockChatPpvServer`

**Impacto:** qualquer usuário autenticado pode chamar a RPC com `gatewayToken: "mock_qualquercoisa"` e desbloquear PPV, fingir assinatura, mandar mimo sem pagar, etc. As `transactions` ficam como `paid` — criadora vê como venda real.

**Correção:** remover o atalho `mock_` e exigir verificação real via NexusPag — consultar a `pix_charges` correspondente pelo `external_id` e confirmar `status = 'paid'` antes de gravar `transactions` / unlocks. Para fluxos legados que ainda dependiam do mock, redirecionar para o fluxo Pix novo já implementado em `checkout.functions.ts`.

### 2. Preço da assinatura aceito do cliente sem validação
`createSubscriptionPixCharge` (checkout) e `subscribeServer` (payments) usam `pricePerMonthCents` enviado pelo frontend.

**Impacto:** atacante manda `pricePerMonthCents: 100` para uma criadora de R$ 50/mês e gera cobrança Pix de R$ 1 — assinatura fica `active` por R$ 1.

**Correção:** dentro do handler, buscar o preço canônico em `profiles.subscription_price_cents` (ou `subscription_plans` se houver `planId`), ignorar o valor do cliente, aplicar cupom validado pelo servidor, e usar esse total como `amount_cents` da Pix.

## 🟡 AVISOS — RLS e padrões

### 3. `withdrawal_requests` sem políticas INSERT/UPDATE
Criadoras não conseguem criar saque via API; admin não consegue aprovar via RLS.
**Correção:** adicionar `INSERT` (`auth.uid() = creator_id` + `has_role(auth.uid(),'creator')`) e `UPDATE` restrito a `has_role(auth.uid(),'admin')`.

### 4. `chat_ppv_unlocks` — criadora não vê quem desbloqueou
**Correção:** adicionar policy `SELECT` permitindo a criadora ver unlocks onde a `chat_messages.sender_id = auth.uid()`.

### 5. Realtime de `chat_messages` aberto demais
A policy do `realtime.messages` filtra só por prefixo `thread:%`. Qualquer autenticado que adivinhe um UUID de thread escuta as mensagens.
**Correção:** policy de realtime que confere se `auth.uid()` é `user_a` ou `user_b` da `chat_threads` correspondente ao `topic`.

### 6. `admin_access_audit` sem INSERT
Auditoria fica silenciosamente vazia.
**Correção:** adicionar policy `INSERT` para `authenticated` (com `user_id = auth.uid()`), assim o middleware de admin consegue gravar o registro.

### 7. CSP com `'unsafe-inline'` em scripts
`src/start.ts` permite scripts inline — anula a proteção contra XSS num site que lida com Pix e mídia privada.
**Correção:** trocar por CSP baseado em nonce (`script-src 'self' 'nonce-{aleatório}'`) gerado por request e injetado nos scripts inline do TanStack/Vite. Onde nonce não couber, usar `'strict-dynamic'`.

### 8. `getPostMediaUrls` faz parsing manual de auth
`src/server/media.functions.ts` importa `getRequestHeader` em try/catch e parseia o Bearer na mão; se falhar, vira anônimo silenciosamente.
**Correção:** refatorar para usar `requireSupabaseAuth` (versão "auth opcional" que permite anônimos para posts públicos, mas usa a mesma cadeia de validação). Mantém consistência com o resto.

### 9. Extensão instalada no schema `public` (linter Supabase)
**Correção:** mover a extensão para o schema `extensions` via migration (`ALTER EXTENSION ... SET SCHEMA extensions`).

## Ordem de execução

1. **(Bloqueante)** #1 e #2 — fraude de pagamento. Sem isso o site não pode receber pagamentos reais.
2. **(Importante)** #3, #4, #5, #6 — migrations de RLS, baixo risco de regressão.
3. **(Hardening)** #7 (CSP nonce) e #8 (refator do auth de mídia).
4. **(Limpeza)** #9 — mover extensão.

## Detalhes técnicos

- Migrations SQL para #3, #4, #5, #6, #9 (alteração de policies / extensão).
- Edição de `src/server/payments.functions.ts` para remover `validateGatewayToken` mock e passar a consultar `pix_charges` pelo `external_id`.
- Edição de `src/server/checkout.functions.ts` para buscar preço canônico da criadora.
- Edição de `src/start.ts` para CSP com nonce + ajuste no `__root.tsx` se for preciso passar nonce a scripts inline do TanStack.
- Refator de `src/server/media.functions.ts` usando o middleware `requireSupabaseAuth` em modo opcional.
- Após cada bloco, rodar novamente o scan e marcar findings como `fixed`.

## Sobre testar

Depois de corrigir #1 e #2, é importante refazer um teste end-to-end de:
- Assinatura via Pix (verificar que o valor cobrado bate com o preço da criadora no banco).
- PPV / mimo / contribuição de meta (confirmar que só desbloqueiam após webhook NexusPag marcar `paid`).
