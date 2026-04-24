

# Diagnóstico: o sistema NÃO está pronto para lançamento

A varredura de segurança encontrou **20 problemas**, sendo **6 críticos (error)** que permitem fraude e vazamento. Antes de abrir ao público, é obrigatório corrigir o bloco P0. Recomendo uma rodada estruturada em 3 prioridades.

## P0 — Bloqueadores críticos (impedem lançamento)

1. **Fraude de pagamento (CRÍTICO)** — Hoje o navegador insere direto na tabela `transactions` com `status='paid'`. Qualquer usuário pode creditar valores arbitrários para si ou desbloquear PPV/gorjetas/metas sem pagar. Precisa migrar `unlock`, `unlockPpv`, `contributeGoal` e `tip` para server functions (`createServerFn`) que validam o gateway antes de gravar.

2. **Conteúdo pago vazando** — A policy de SELECT em `posts` e `post_media` é `USING true`. Qualquer pessoa (até deslogada) lê o corpo e o caminho da mídia de posts PPV e "subscribers only". Reescrever policies para filtrar por `visibility` + assinatura ativa + unlock pago.

3. **Bucket `posts` sem proteção real** — Mesmo com policies corrigidas, qualquer autenticado baixa qualquer arquivo do bucket. Trocar para bucket privado + URLs assinadas geradas em server function que checa assinatura/unlock.

4. **Escalada de privilégio em `user_roles`** — Falta policy de INSERT explícita. Risco de qualquer usuário se promover a admin/creator. Adicionar policy WITH CHECK exigindo admin.

5. **Realtime aberto** — Sem RLS em `realtime.messages`, qualquer autenticado escuta qualquer thread privada. Adicionar policy restringindo subscrição a `user_a`/`user_b` da thread.

6. **Webhook de mailing sem auth** — `/api/public/hooks/process-mailing-queue` usa service-role sem checar segredo. Qualquer um na internet dispara DMs em massa. Adicionar verificação `Authorization: Bearer ${CRON_SECRET}` e configurar segredo no pg_cron.

7. **Rotas admin sem guarda no servidor** — `admin.kyc`, `admin.dmca`, `admin.moderation` checam `isAdmin` só no React. Adicionar `beforeLoad` chamando server function que revalida o role.

8. **Mídia de chat invisível ao destinatário** — Policy do bucket `chat-media` só libera para o sender. Recipiente não consegue ver o que recebeu. Adicionar policy de SELECT para o outro participante da thread.

## P1 — Importantes antes de escalar

9. Decisões de moderação salvas em `localStorage` — criar tabela `moderation_decisions` com server function de persistência e auditoria.
10. Mailing em massa: envolver `enqueue_mass_dm` em server function com rate limit e revalidação de role.
11. `affiliate_codes`, `subscription_coupons`, `follows` com SELECT público total — restringir.
12. Headers de segurança ausentes — adicionar middleware com CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, HSTS.

## P2 — Polimento

13. Listing público dos buckets `avatars/covers/posts/stories` — restringir SELECT em `storage.objects` à leitura por path conhecido, sem listagem.
14. Mover extensões do schema `public` para `extensions`.
15. Limpar a função antiga `mass_send_dm` (substituída por `enqueue_mass_dm` + fila), evitando duas APIs paralelas.
16. Verificação de e-mail real no signup (hoje pode estar com auto-confirm dependendo da config) e fluxo de "esqueci senha" testado de ponta a ponta.
17. Termos de uso, política de privacidade, fluxo de KYC obrigatório para criadoras antes de receber pagamentos, e fluxo de DMCA acessível publicamente — itens legais obrigatórios para plataforma adulta.
18. Testes manuais finais: signup → verificação → onboarding → assinatura → PPV → saque → cancelamento.

## Plano de execução proposto

Sugiro fazer em **uma rodada P0 completa** (8 correções acima, todas ligadas a segurança/fraude). Sem isso o lançamento expõe você a prejuízo financeiro direto e a vazamento de conteúdo pago dos criadores.

Detalhes técnicos:
- Novas server functions: `processPayment`, `unlockPpvServer`, `tipServer`, `contributeGoalServer`, `getSignedPostMedia`, `requireAdmin`.
- Migração SQL: reescrever 6 policies (posts, post_media, user_roles INSERT, realtime.messages, storage.objects para `posts` e `chat-media`).
- Novo segredo: `CRON_SECRET` + atualização do job `pg_cron` para enviar o header.
- `beforeLoad` server-side em todas as rotas `admin.*` usando middleware de auth já existente em `src/integrations/supabase/auth-middleware.ts`.

## Resposta direta à sua pergunta

**Não lance ainda.** Funcionalmente está rico (feed, chat, PPV, mailing, linktree, temas), mas a camada de segurança/pagamento tem buracos que seriam explorados em horas após ir ao ar. Aprova que eu execute o **bloco P0 completo** na próxima rodada?

