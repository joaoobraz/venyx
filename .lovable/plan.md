# Auditoria: o que realmente falta

A base está muito completa. Mas olhando rotas, tabelas e componentes, identifiquei lacunas reais — não "ideias bonitas", mas coisas que faltam pra plataforma rodar 100% no mundo real.

---

## 🔴 Crítico (bloqueia operação real)

### 1. Cron de processamento de mailing em massa
A função `process_mass_dm_batch` existe no banco, mas **nada a chama**. Campanhas agendadas ficam paradas em `pending` pra sempre. Precisa de um endpoint `/api/public/cron/process-mass-dm` chamado por pg_cron a cada minuto.

### 2. Expiração automática de assinaturas
Não há job que marca `subscriptions.status = 'expired'` quando `current_period_end < now()`. Hoje, assinaturas vencidas continuam ativas até o usuário tentar renovar. Cron diário resolve.

### 3. Expiração de stories
Tabela `stories` tem `expires_at`, mas nenhum cron remove stories expiradas do storage. Vai acumular lixo no bucket.

### 4. Página pública do criador — preview pra quem não assina
Verificar `profile.$username.tsx`: precisa mostrar bio, avatar, capa, contador de posts, botão de assinar e **grid de posts borrados/cadeado** pra converter visitante em assinante. Hoje provavelmente está minimal.

---

## 🟡 Importante (impacta receita/UX)

### 5. Renovação automática de assinaturas (recorrência real)
Hoje só existe pagamento único via PIX. Sem recorrência, retenção despenca no fim do mês. Como PIX não suporta recurring nativo, o caminho é:
- Cron que detecta assinaturas vencendo em 3/1/0 dias
- Envia notificação + link de renovação 1-clique (cobrança PIX pré-gerada)
- Opcional: cartão via gateway (Stripe/Pagar.me) numa fase futura

### 6. Notificações push (web push)
Tabela `notifications` existe, mas só funciona se o usuário estiver no site. Sem web push (Service Worker + VAPID), criadora perde engajamento de quem não abre o app. Crítico pra mass DM converter.

### 7. Email transacional
Não vi integração de email. Nada de "novo PPV recebido", "alguém te mandou gorjeta", "sua assinatura vai vencer", reset de senha customizado, etc. Email é canal de retenção #1.

### 8. Busca/descoberta melhor
Tem `/explore` e `/search`, mas falta:
- Filtros (preço, categoria, online agora, novos)
- Tags/categorias nos perfis (loira, fitness, cosplay, etc.)
- "Trending" baseado em métricas reais (assinantes novos últimos 7 dias)

### 9. Sistema de referral pra fãs (não só ambassador)
Existe `affiliate_codes` pra ambassadors. Falta usuário comum poder convidar amigos com bônus mútuo (ex: "ganhe R$10 quando seu amigo assinar qualquer criadora").

---

## 🟢 Polimento (nice to have)

### 10. Onboarding guiado pra criadora nova
Existe `OnboardingChecklist.tsx` — verificar se cobre: completar perfil, definir preço, postar 1º conteúdo, configurar PIX, ativar 2FA. Se faltar passos, completar.

### 11. Dashboard de analytics mais profundo
`creator.analytics.tsx` existe — verificar se tem: receita por fonte (sub vs PPV vs tip vs chat), churn rate, LTV médio, top fãs, melhor horário pra postar.

### 12. Backup/export de dados pro criador
LGPD: criadora deve poder exportar todos os dados dela (lista de fãs, mensagens, transações) em CSV/JSON. Botão em settings.

### 13. Modo "férias" pra criadora
Pausar cobranças de novas assinaturas mas manter as ativas, com aviso no perfil. Evita reembolso quando criadora some.

### 14. Live streaming / videochamada paga
Mercado grande, mas tecnicamente pesado (precisa LiveKit/Agora/Daily). É um produto à parte — só vale se for prioridade estratégica.

### 15. App mobile (PWA)
Adicionar manifest.json + service worker pra instalar como app no celular. Baixo esforço, alto impacto percebido.

---

## Minha recomendação

Se eu tivesse que escolher **3 pra fazer agora**, em ordem:

1. **Crons essenciais** (#1, #2, #3) — sem isso a plataforma "vaza" silenciosamente
2. **Email transacional + web push** (#6, #7) — multiplica retenção
3. **Página pública do criador convertendo melhor** (#4) — multiplica conversão

Me diz quais você quer que eu implemente que eu monto o plano detalhado. Ou se quer só os crons (que é o mais urgente), eu já faço direto.
