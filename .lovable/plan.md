
# Plataforma de Conteúdo +18 (estilo Privacy)

Plataforma bilíngue (PT/EN), tema escuro com acentos laranja, inspirada no visual do Privacy. Entrega em **fases incrementais** começando pelo núcleo.

## Ajuste de fluxo de cadastro
- **Todo novo cadastro entra como Cliente (Assinante)** automaticamente — sem escolha de tipo de perfil no signup
- No perfil/área do usuário existe um **bloco em destaque bem visível** (banner laranja com call-to-action) "Torne-se Criadora — Comece a ganhar com seu conteúdo"
- Ao clicar, vai para `/become-creator`: explicação dos benefícios + formulário de KYC (documento + selfie)
- Após aprovação do KYC pelo admin, o usuário ganha o role `creator` (em adição ao `subscriber`) e desbloqueia o painel de criador, composer de posts, carteira, etc.
- O banner desaparece quando o usuário já é criadora ou tem KYC pendente (mostra status: "Verificação em análise")

## Stack & Infra
- **Lovable Cloud**: banco, auth (email/senha + Google), storage de mídia
- **Roles em tabela separada** (`user_roles`): `subscriber` (padrão), `creator`, `admin` — função `has_role()` security-definer
- **i18n** PT-BR (padrão) / EN com toggle no header
- Pagamentos: estrutura preparada (transações, saldo, botões funcionais com mock) — gateway plugado depois

---

## Fase 1 — Núcleo

### Onboarding & Auth
- Modal **18+** obrigatório no primeiro acesso (cookie)
- Login/cadastro: email+senha e Google
- **Cadastro cria automaticamente role `subscriber`** — sem pergunta de tipo
- Recuperação de senha em `/reset-password`

### Perfis
- `/profile/$username` público: capa, avatar, bio, links, abas Posts/Mídia/Sobre
- `/settings/profile` para edição
- Selo laranja de verificação após KYC aprovado
- **Banner "Torne-se Criadora"** em destaque na própria página de perfil e no menu lateral (só aparece para quem ainda não é criadora)

### Tornar-se Criadora (KYC)
- `/become-creator`: landing explicativa (benefícios, comissão, como funciona) + botão "Iniciar verificação"
- Formulário KYC: tipo de documento, frente, verso, selfie segurando documento, aceite de termos +18
- Status: pendente / aprovado / rejeitado (com motivo)
- Painel admin `/admin/kyc` para revisar e aprovar/rejeitar
- Após aprovação: role `creator` adicionado, acesso liberado a composer, carteira, painel de assinantes

### Feed & Conteúdo
- `/feed` com posts dos criadores seguidos
- Post: texto + galeria, curtidas, comentários, mimo
- **PPV**: thumbnail borrada + botão "Desbloquear por R$ X" → liberação permanente após pagamento
- Composer (só para criadoras): grátis / só assinantes / PPV com preço
- Salvar posts (favoritos)

### Assinaturas
- Cada criadora define preço mensal
- Botão "Assinar" no perfil → registro de assinatura recorrente (cobrança real quando gateway escolhido)
- Gestão em `/settings/subscriptions`

### Chat 1-a-1
- `/chat`: lista de conversas + thread (igual ao print)
- Busca, filtro "online", presença em realtime
- Texto, mídia e **mídia PPV no chat** (desbloqueio pago)
- Botão de mimo na conversa
- Indicador de não lidas

### Descoberta
- `/explore`: Em alta, Novos criadores, Categorias
- `/search` global

### Financeiro
- `/creator/wallet`: saldo, histórico, solicitação de saque (só visível se for criadora)
- `/settings/purchases`: histórico de compras
- `/admin/transactions`: painel admin

### Notificações
- Sino no header: novos seguidores, mensagens, compras, mimos, comentários

---

## Fase 2 — Avançado
- Stories (24h), Lives com chat e mimos, Afiliados/referência, Listas/Coleções privadas, Ranking semanal automatizado

---

## Estrutura de rotas
```
/                       Landing pública
/login, /signup, /reset-password
/feed, /explore, /search                 (autenticado)
/profile/$username                        (público)
/post/$id
/chat, /chat/$conversationId
/notifications
/become-creator                           (assinante → vira criadora)
/settings/profile, /settings/subscriptions, /settings/purchases, /settings/security
/creator/wallet, /creator/posts, /creator/subscribers   (só criadora)
/admin/kyc, /admin/users, /admin/transactions           (só admin)
```

## Visual
Fundo `#000`, acentos laranja, cards arredondados, ícones Lucide, toggle PT/EN no header. Banner "Torne-se Criadora" com gradiente laranja e CTA grande para ser bem visível.

## Segurança
- RLS em todas as tabelas; roles em tabela separada com `has_role()` security-definer
- Acesso a mídia PPV/assinante validado server-side antes de gerar URL assinada
- Validação Zod em formulários e server functions
- KYC obrigatório antes de qualquer publicação como criadora
- Aviso 18+ em todo acesso
