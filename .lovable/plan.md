# O que ainda falta antes de lançar

Comparando o estado atual com a varredura mais recente, a maior parte do bloco P0 original já foi resolvida (RLS de posts, recursão, server functions de pagamento, middleware admin, webhook de mailing, mídia de chat). Mas a varredura ainda aponta **2 erros críticos** e **8 avisos**, mais alguns itens operacionais/legais que faltam para abrir ao público.

## P0 — Bloqueadores que ainda existem

1. **Pagamento ainda é mock (CRÍTICO)**
   `validateGatewayToken` em `src/server/payments.functions.ts` aceita qualquer token que comece com `mock_`. O front envia `mock_${Date.now()}` e o servidor grava `status: 'paid'`. Hoje qualquer pessoa consegue desbloquear PPV, gorjetas e assinaturas de graça.
   → Decisão necessária: integrar Stripe ou Paddle (ambos têm conector nativo no Lovable). Sem gateway real, não dá para abrir vendas.

2. **Stories vazando para anônimos (CRÍTICO)**
   A policy de SELECT em `stories` só checa `expires_at > now()`, ignorando o campo `visibility`. Bucket `stories` é público também. Qualquer um lê stories "subscribers only".
   → Reescrever a policy considerando `visibility` + assinatura ativa, e migrar bucket para privado com URLs assinadas.

## P1 — Importantes antes de escalar

3. **Realtime com ELSE permissivo**
   Policy de `realtime.messages` libera qualquer canal que não comece com `thread:%` para qualquer autenticado. Se amanhã criarmos canais `notifications:%` ou `campaign:%`, vazam. Trocar o ELSE por WHEN explícitos.

4. **Buckets públicos permitem listagem** (3 avisos do linter)
   `avatars`, `covers`, `posts` (e provavelmente `stories`) têm SELECT amplo em `storage.objects`. Restringir para leitura por path conhecido, sem listagem.

5. **Mensagens de erro do banco vazando**
   `payments.functions.ts` e `admin.functions.ts` fazem `throw new Error(error.message)`, expondo nomes de tabelas/colunas/constraints. Trocar por mensagens neutras + log server-side.

6. **Headers de segurança ausentes**
   Não existe middleware global do TanStack Start setando CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, HSTS. Em plataforma adulta, qualquer XSS vira roubo de sessão.

7. **Moderação CSAM "fail-open"**
   `moderate-media` retorna `{ allowed: true }` quando a IA falha. Para CSAM o padrão deve ser **bloquear** e mandar para revisão manual. Mudar para fail-closed + fila.

8. **Extensões no schema `public`**
   Mover para schema `extensions` (warning do linter).

## Itens operacionais / legais (fora da varredura, mas obrigatórios)

9. **Verificação de e-mail**: confirmar que auto-confirm está desligado no Auth e testar fluxo signup → e-mail → login.
10. **Reset de senha**: testar fluxo ponta a ponta.
11. **Termos de Uso e Política de Privacidade**: as páginas existem (`/terms`, `/privacy`), mas precisam de conteúdo jurídico real para plataforma adulta brasileira (LGPD, idade mínima, direitos autorais).
12. **KYC obrigatório para criadoras antes de saque**: a tela `admin.kyc` existe; falta bloquear saque na `creator.wallet` enquanto KYC não estiver `approved`.
13. **DMCA público**: `/dmca` precisa estar acessível sem login e linkado no rodapé.
14. **Teste manual ponta a ponta**: signup → verificação → onboarding → assinatura paga real → PPV → saque → cancelamento.

## Plano de execução sugerido (ordem)

**Rodada A — Pagamento real** (decisão sua antes de eu mexer)
- Pergunta: **Stripe ou Paddle?** Stripe é mais comum no Brasil; Paddle resolve impostos globais. Ambos têm conector pronto.
- Implementar webhook `/api/public/hooks/payment` com verificação de assinatura.
- Trocar `validateGatewayToken` por `stripe.paymentIntents.retrieve(token)` (ou equivalente Paddle).

**Rodada B — Resto da segurança** (uma migration + um middleware)
- Migration: corrigir RLS de `stories`, `realtime.messages`, listagem de buckets, mover extensões.
- Bucket `stories` privado + server function `getSignedStoryUrl`.
- Middleware global em `src/router.tsx` com CSP + headers.
- Sanitizar erros em `payments.functions.ts` e `admin.functions.ts`.
- `moderate-media`: fail-closed + tabela `moderation_queue`.

**Rodada C — Legal e operacional**
- Conteúdo de Termos / Privacidade / DMCA (posso gerar minutas em pt-BR).
- Bloqueio de saque sem KYC aprovado.
- Configuração de Auth (verificação de e-mail) e teste do reset.

## Pergunta para destravar a Rodada A

Qual gateway de pagamento usar — **Stripe** (recomendado para Brasil) ou **Paddle** (melhor para vendas internacionais com impostos automáticos)? Sem essa decisão, o item #1 fica travado e não dá para lançar com cobrança real.
