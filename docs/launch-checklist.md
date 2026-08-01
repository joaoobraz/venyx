# Venyx — checklist de lançamento

Atualizado em 31/07/2026.

## Bloco 1 — experiência, demonstração e segurança

- [x] Substituir fotos de demonstração por quatro adultas fictícias geradas por IA.
- [x] Impedir que os assets de demonstração sejam usados como fallback em produção.
- [x] Top 15, com atualização/cache de 6 horas.
- [x] Mostrar empty state honesto quando ainda não houver criadoras verificadas com plano ativo.
- [x] Navegação mobile fixa, menu de conta e acesso à área da criadora.
- [x] Chat mobile em fluxo lista → conversa, com botão de voltar.
- [x] Revisar feed, explorar, perfil e chat em 390 × 844 e desktop.
- [x] Marca-d'água no formato `Venyx.com.br/profile/nome-da-criadora`.
- [x] Denunciar, bloquear e silenciar em posts, perfis e conversas.
- [x] Fila administrativa para analisar denúncias.
- [x] PT/EN no site público e nas jornadas principais do assinante.
- [x] Tradução sob demanda para textos publicados por usuários.
- [x] Curtidas com incremento/decremento único e bloqueio de clique duplicado.
- [x] Comentários persistentes, exibidos dentro do post e removíveis pelo autor ou pela criadora.
- [x] Contagem de comentários reconciliada com os comentários realmente visíveis.
- [x] Denunciar e bloquear diretamente em cada comentário.
- [x] Limite de cinco comentários por minuto, bloqueio de duplicatas e filtro anti-spam.
- [x] Respostas e menções `@username` nos comentários.
- [x] Paginação de comentários em blocos de 20.
- [x] Notificar a criadora por curtidas e comentários, além de avisar respostas e menções.
- [x] Chat com envio persistente, restauração após recarregar e confirmação de leitura.
- [x] Badge de não lidos e prévia da última mensagem no chat.
- [x] Fazer cada aviso de mensagem abrir a conversa exata e eliminar notificações órfãs.
- [x] Criar conversas fictícias identificadas como demonstração, com envio e persistência local.
- [x] Indicadores de presença online/offline e “digitando…” por conversa.
- [x] Edição de comentários e mensagens por até 15 minutos.
- [x] Silenciamento de notificações por publicação e por conversa.
- [x] Painel da criadora para bloquear palavras e usuários recorrentes nos comentários.
- [x] Favoritos com prévia visual, nome e `@username` da criadora.
- [x] Capa obrigatória escolhida pela criadora para publicações em vídeo.
- [x] Aplicar e testar a migração de segurança no Supabase staging.
- [x] Aplicar e testar a migração de curtidas, comentários e capas no Supabase staging.
- [x] Aplicar e testar a migração de comentários, notificações e chat no Supabase staging.
- [x] Aplicar e testar a migração de preferências, edição e moderação da criadora no Supabase staging.
- [x] Aplicar e testar a migração de reconciliação de estornos no Supabase staging.
- [x] Aplicar e validar a migração de integridade das notificações do chat no Supabase staging.
- [x] Remover dependências operacionais da Lovable e gerar um build portátil para hospedagem própria.
- [x] Completar a tradução PT/EN do backoffice interno de criadoras e administradores.

## Bloco 2 — P0 antes de abrir ao público

- [x] Fazer moderação de imagem e vídeo falhar de forma segura quando o provedor estiver indisponível.
- [x] Remover os casos em que vídeos ou arquivos grandes pulam a moderação (cinco quadros por vídeo; imagem grande redimensionada).
- [x] Publicar `moderate-media-v2`, `translate-message` e `suggest-caption` no staging, com autenticação e CORS validados.
- [ ] Configurar `AI_CHAT_COMPLETIONS_URL`, `AI_API_KEY`, `AI_TEXT_MODEL`, `AI_VISION_MODEL` e `ALLOWED_ORIGINS` no staging; até lá, novos uploads permanecem bloqueados de forma segura.
- [x] Testar denúncia, bloqueio e silenciamento ponta a ponta no staging, incluindo tentativas negadas pelas políticas de segurança.
- [x] Proteger webhook NexusPag contra assinatura inválida, replay, referência/valor divergente e eventos duplicados.
- [ ] Configurar `NEXUSPAG_API_KEY`, `NEXUSPAG_WEBHOOK_SECRET` e `PUBLIC_WEBHOOK_URL` no ambiente do staging.
- [ ] Testar assinatura, PPV, mimo, estorno e webhook com idempotência.
- [x] Apontar o localhost explicitamente para o Supabase staging e impedir mistura acidental entre identificador e URL de projetos diferentes.
- [ ] Substituir e-mails e domínios provisórios (`@plataforma.com`) pelos dados oficiais da Venyx.
- [ ] Confirmar termos, privacidade, DMCA e política de conteúdo com assessoria jurídica.

## Bloco 3 — operação do lançamento

- [ ] Cadastrar apenas criadoras reais, verificadas e com plano ativo no ranking público.
- [x] Definir rotina de revisão de denúncias e SLA para risco de menor de idade.
- [x] Criar dados de demonstração identificados e separados dos dados reais, com conversas locais que não poluem o staging.
- [x] Criar endpoint de saúde e manual operacional de incidentes, moderação e lançamento gradual.
- [ ] Ativar monitoramento e alertas externos e validar restauração de backup no provedor escolhido.
- [ ] Rodar teste completo em iPhone/Android e nos principais navegadores.
- [ ] Fazer lançamento gradual com grupo pequeno antes de liberar todo o tráfego.
