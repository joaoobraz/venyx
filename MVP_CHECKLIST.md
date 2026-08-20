# Checklist de abertura do MVP Fanlira

Atualizado em: 19/08/2026

## Auditoria de prontidão — 19/08/2026

### Validado nesta auditoria

- [x] Projeto Supabase de produção criado e schema-base aplicado.
- [x] Login por e-mail e Google OAuth configurados para `fanlira.com.br` e ambiente local.
- [x] Login Google validado de ponta a ponta em produção, com retorno autenticado para `/inicio`.
- [x] Perfil interno criado automaticamente para contas OAuth antigas e novas; leitura autenticada corrigida com privilégio mínimo e RLS preservada.
- [x] Edição de perfil e rota pública do usuário autenticado validadas no domínio oficial.
- [x] Privilégios do Data API restaurados a partir das políticas RLS: 150 operações protegidas auditadas, 0 permissões necessárias ausentes e mutações financeiras críticas mantidas somente no servidor.
- [x] Feed, explorar, mensagens, notificações, perfil, pagamentos, privacidade, segurança, ajuda e entrada de criadora validados autenticados em produção sem erro de console.
- [x] Domínio raiz e `www` respondendo com HTTPS e cabeçalhos de segurança.
- [x] Endpoint público de saúde respondendo com banco conectado.
- [x] Typecheck aprovado.
- [x] 91 testes automatizados aprovados; os dois testes removidos pertenciam ao aviso global de idade descontinuado.
- [x] Lint aprovado sem erros (restam avisos de manutenção).
- [x] Build Cloudflare aprovado.
- [x] Teste de carga público aprovado sem falhas em 180 requisições, com concorrência 12 (p95 de 744 ms na amostra).
- [x] Build ajustado para não manter `.dev.vars` no artefato final.
- [x] Rotas dinâmicas locais corrigidas para precompilar dependências CommonJS corretamente no Vite.
- [x] Home, login, cadastro, exploração, perfil, mimos, Fanlira Links e ajuda validados no navegador local.
- [x] Responsividade das jornadas públicas validada em 390 × 844 sem rolagem lateral.
- [x] Deploy configurado para exigir os segredos críticos e bloquear o subdomínio público `workers.dev`.
- [x] Turnstile criado para raiz e `www`, habilitado no Supabase e validado no cadastro público.
- [x] Aviso global de maioridade removido da entrada; a verificação continua aplicada antes de mídia protegida, assinatura, chat e pagamentos.
- [x] Worker `fanlira` publicado nos dois domínios; smoke de produção aprovado e nova amostra pública de 80 requisições sem falhas.
- [x] Chaves da ImpulsePay rotacionadas, autenticadas na API e armazenadas como segredos do Worker.
- [x] Webhook ImpulsePay cadastrado para pagamentos e saques; proteção publicada validada com rejeição sem token.
- [x] Verificação manual e privada de identidade/idade implementada para clientes e criadoras, sem fornecedor pago no MVP.
- [x] Posts, stories e mídias de chat entram ocultos em fila manual e só são liberados após aprovação administrativa com MFA.

### Bloqueadores para abrir ao público

- [x] Rotacionar todas as chaves da ImpulsePay que foram compartilhadas em conversa e revogar as anteriores.
- [x] Cadastrar no Cloudflare os segredos de produção: `SUPABASE_SERVICE_ROLE_KEY`, chaves ImpulsePay, token do webhook e `CRON_SECRET`.
- [ ] Ativar e validar os e-mails operacionais `@fanlira.com.br` usados no suporte e na recuperação de conta.
- [x] Publicar a versão atual: o `/api/public/health` identifica o serviço como `fanlira` e o smoke de produção foi aprovado.
- [ ] Configurar SMTP transacional próprio e validar SPF, DKIM, DMARC, confirmação de cadastro e recuperação de senha.
- [~] O domínio já publica MX da Hostinger, SPF e DMARC; ainda faltam confirmar DKIM, configurar o SMTP no Supabase e testar entrega/recuperação em caixas reais.
- [x] Turnstile implementado no cadastro, login e recuperação, com chaves ativas e validação habilitada no Supabase.
- [x] Ativar verificação manual de identidade/idade com documento, selfie, trilha de auditoria e decisão administrativa.
- [x] Ativar moderação manual preventiva de posts, stories e mídias do chat, bloqueando a entrega até a decisão humana.
- [ ] Treinar duas pessoas para seguir o procedimento manual de KYC e moderação; nunca aprovar em caso de dúvida.
- [ ] Obter revisão jurídica brasileira dos Termos, Privacidade, conteúdo não consentido, maioridade, DMCA, pagamentos e política de não estorno.
- [ ] Executar e guardar evidências de pagamentos PIX reais: assinatura, PPV, mimo, chat/upsell, webhook idempotente e saque.
- [~] Monitor de produção e backup integral foram implementados; o webhook externo de alertas é opcional no MVP, mas ainda faltam destino operacional e restauração real documentada.
- [ ] Testar fisicamente em iPhone/Safari, Android/Chrome e desktop/Safari, incluindo troca para o aplicativo bancário e retorno do PIX.
- [ ] Cadastrar e aprovar 5–10 criadoras reais, revisar consentimentos e aprovar a primeira publicação de cada uma.
- [ ] Rodar piloto controlado por pelo menos 72 horas antes da abertura pública.
- [ ] Regularizar o faturamento da conta GitHub: os jobs não iniciam porque a conta está bloqueada por cobrança; depois, reexecutar os gates da PR e só então mesclar em `main`.
- [x] Histórico Git restaurado sem sobrescrever arquivos; branch local reconectada a `origin/demo-investidores`.
- [x] Conta Cloudflare e Worker existentes auditados: Worker `fanlira`, domínio oficial e logs ativos.
- [x] Reautenticar o Wrangler deste computador na conta correta `77bd53fa8469f1ee770e51db59633e9d`.
- [x] Completar os bindings críticos do Worker: credenciais `IMPULSEPAY_*`, token de webhook, `CRON_SECRET`, Supabase e Turnstile. O encaminhamento externo de alertas permanece opcional.
- [x] Migração final de menor privilégio aplicada em produção; Security Advisor permanece com 0 erros e caiu de 88 para 29 avisos conhecidos.

### Resultado atual

**Ainda não liberar para clientes reais.** A infraestrutura técnica está publicada e validada. KYC e moderação não exigem fornecedor pago no piloto, mas a abertura comercial ainda depende de operação humana treinada, configuração de e-mail, validação jurídica, testes financeiros reais e piloto controlado.

### Próximas ações do responsável — na ordem

1. [ ] Regularizar a cobrança do GitHub, reexecutar os checks da PR de lançamento e mesclar em `main` somente quando todos ficarem verdes.
2. [ ] Confirmar no painel da Hostinger que `suporte`, `privacidade`, `abuse`, `dmca`, `legal` e `seguranca` recebem mensagens; separar as credenciais SMTP para o Supabase.
3. [ ] Selecionar e treinar duas pessoas responsáveis pela verificação e moderação manual, usando `docs/operations/MANUAL_KYC_AND_MODERATION.md`.
4. [ ] Enviar Termos, Privacidade, DMCA, maioridade, conteúdo não consentido e pagamentos para revisão jurídica brasileira e devolver as versões aprovadas.
5. [ ] Disponibilizar os aparelhos/contas para a matriz física e autorizar, uma cobrança por vez, os testes PIX de baixo valor e o saque real.
6. [ ] Definir destino de backup criptografado e executar uma restauração completa em ambiente separado.
7. [ ] Selecionar 5–10 criadoras adultas reais, concluir KYC/consentimento e operar um piloto fechado por no mínimo 72 horas.
8. [ ] Definir telefone de escalonamento interno para moderação crítica, suporte e incidentes.

## Como usar

- `[x]` concluído e verificável.
- `[~]` implementação parcial; ainda falta integração ou prova real.
- `[ ]` pendente.
- `BLOQUEIO EXTERNO` depende de credencial, fornecedor, operação humana ou parecer profissional.

Um bloco só pode ser marcado como concluído quando seu critério de aceite tiver sido testado.

## Ordem de execução

1. Pagamento real ponta a ponta.
2. Entrada e publicação de criadoras reais.
3. Segurança operacional.
4. Suporte e direitos do usuário.
5. Medição, estabilidade e abertura controlada.

---

## 1. Pagamento real ponta a ponta — P0

### Cobranças

- [~] Assinatura por PIX: checkout, QR Code, consulta de status e liberação existem.
- [~] PPV de publicação: checkout e liberação existem.
- [~] Mimo: checkout e crédito da transação existem.
- [~] PPV no chat, meta e upsell: fluxos implementados, ainda sem prova financeira real.
- [x] Idempotência local: cobrança usa `external_id` e o fulfillment evita duplicidade.
- [ ] Executar uma compra real de baixo valor para cada finalidade e guardar a evidência.

Critério de aceite: um pagamento confirmado na Impulse Pay deve aparecer uma única vez na Fanlira e liberar somente o produto comprado.

### Cancelamento e renovação

- [x] Expiração automática de assinaturas possui job ativo no Supabase a cada hora.
- [x] Rotina manual protegida por `CRON_SECRET` rejeita chamadas ausentes ou incorretas.
- [x] Tela do cliente para listar, cancelar e desfazer o cancelamento de assinaturas.
- [x] Cancelamento programado mantém o acesso até o fim do período contratado.
- [x] O MVP não oferece solicitação ou botão de estorno; cancelamentos encerram somente no vencimento.
- [x] Reversões excepcionais recebidas do provedor continuam conciliadas internamente para impedir acesso ou saldo incorreto.
- [~] Renovação manual por novo PIX e avisos de 7, 3 e 1 dia implementados; agendador configurado e falta validar com uma cobrança real.
- [x] Confirmado em 20/08/2026 na documentação oficial: a Impulse Pay oferece recorrência documentada somente por cartão; `POST /v1/transactions` cria PIX avulso e não expõe PIX Automático.
- [ ] Definir outro meio/provedor ou aguardar endpoint oficial da Impulse Pay se a decisão comercial exigir PIX Automático.

Decisão do MVP: assinaturas atuais continuam com renovação manual por um novo PIX. A cobrança recorrente por cartão só será habilitada após concluir checkout, tokenização, 3DS e webhooks de assinatura da Impulse Pay. Não haverá fluxo de estorno solicitado pelo usuário no MVP.

### Saldo e saque

- [~] Carteira, saldo disponível/pendente, chave PIX e solicitação de saque existem.
- [x] KYC e 2FA são exigidos no backend para solicitar saque.
- [~] Aprovação, rejeição, marcação como pago e comprovante existem no painel administrativo.
- [x] Integrar o saque da Fanlira ao endpoint `/v1/transfers` da Impulse Pay.
- [x] Conciliar `withdrawal.processing`, `withdrawal.completed` e `withdrawal.failed` da Impulse Pay.
- [x] Aplicar mínimo de R$ 30,00 e limite atômico de 5 saques por dia no fuso de São Paulo.
- [x] Primeiro saque válido do dia grátis; do segundo ao quinto, cobrar R$ 3,00 por saque.
- [x] Absorver a taxa da Impulse Pay no saldo da Fanlira: depois da resposta do gateway, a carteira da criadora é debitada pelo líquido transferido mais somente a taxa Fanlira aplicável. Como a API não publica cotação antecipada da tarifa, a interface mostra separadamente valor solicitado, líquido transferido e tarifa absorvida.
- [ ] Executar e comprovar um saque real de baixo valor.

### Webhook e conciliação

- [x] Endpoint de webhook com limite de corpo, token secreto em comparação de tempo constante e confirmação autenticada na API da Impulse Pay.
- [x] Não confiar no payload recebido: conferir ID, valor, referência externa e estado diretamente na Impulse Pay antes do fulfillment.
- [x] Processamento idempotente de pagamento e reversões excepcionais no código.
- [x] Configurar as credenciais `IMPULSEPAY_*` como segredos do Worker e validar a autenticação na API.
- [x] Publicar o endpoint em HTTPS e cadastrar a URL com token na Impulse Pay.
- [x] Varredura protegida implementada como contingência do webhook, com chaves reais e agendamento no endereço público.
- [x] Criar painel administrativo de divergências entre Impulse Pay e Fanlira, com histórico e resolução auditada.

`BLOQUEIO EXTERNO`: credenciais reais Impulse Pay, URL pública HTTPS e saldo para transações de validação.

---

## 2. Entrada de criadoras reais — P0

### Cadastro e aprovação

- [x] Cadastro por e-mail e recuperação de conta.
- [x] Envio privado de documento, verso e selfie para KYC.
- [x] Painel administrativo para aprovar ou rejeitar KYC e verificação +18 de clientes.
- [x] Aprovação promove a conta para o papel de criadora no backend.
- [x] Adotar revisão humana como processo do MVP; integração automatizada fica para quando o volume justificar.
- [x] Registrar consentimento, versão dos termos, data, IP e evidência de maioridade.

### Conteúdo e monetização

- [x] Upload protegido e moderação manual antes da publicação existem para posts, stories e mídia no chat.
- [~] Preço de assinatura, planos, cupons, PPV e primeira publicação existem.
- [x] Criar jornada única pós-aprovação: perfil → preço → dados de saque → primeira publicação.
- [x] Bloquear publicação monetizada até KYC, perfil e chave de saque estarem válidos.
- [ ] Fazer teste completo com uma criadora piloto.

### Abertura controlada

- [ ] Recrutar 5–10 criadoras reais.
- [ ] Aprovar KYC e revisar manualmente a primeira publicação de cada uma.
- [ ] Obter autorização contratual e contato de emergência operacional.
- [ ] Abrir primeiro para um grupo pequeno de clientes convidados.

`BLOQUEIO EXTERNO`: criadoras reais, documentos, consentimentos e operação humana de aprovação.

---

## 3. Segurança operacional — P0

- [x] Moderação preventiva manual de imagem e vídeo com bloqueio por padrão até a aprovação.
- [x] Processo sem fornecedor pago adotado para o piloto; automação passa a ser critério de escala, não de lançamento.
- [x] Não há aviso global de entrada. A maioridade é validada no cadastro/identidade e novamente antes de assinatura, PPV, mimo, chat pago ou acesso a mídia protegida.
- [x] Fila de denúncias, estados de análise e ações administrativas existem.
- [~] Bloqueio, silenciamento, DMCA e auditoria administrativa existem.
- [x] Criar escala de prioridade e SLA: risco de menor/não consentimento deve ser imediato.
- [x] Criar procedimento de preservação de evidência e comunicação às autoridades aplicáveis.
- [ ] Treinar ao menos duas pessoas para a fila crítica; nunca depender de uma única pessoa.
- [~] Termos, privacidade e DMCA possuem rascunhos no produto.
- [~] Contatos foram migrados para `@fanlira.com.br`; falta ativar e testar as caixas de e-mail.
- [ ] Revisão jurídica brasileira especializada em LGPD, conteúdo adulto, consumidor e pagamentos.

`BLOQUEIO EXTERNO`: equipe humana treinada e parecer jurídico.

### Planejado para V1.1

- [ ] Completar razão social/nome legal, CPF/CNPJ e endereço público da operação.

---

## 4. Suporte mínimo e direitos do usuário — P1

- [x] Página “Preciso de ajuda” com protocolo e categorias.
- [x] Caixa administrativa de solicitações de suporte.
- [x] Recuperação de senha por e-mail.
- [x] Fluxo rastreável de recuperação quando o usuário perdeu o e-mail ou 2FA.
- [x] Solicitação autenticada de exportação de dados.
- [x] Solicitação de exclusão com prazo, confirmação e exceções legais de retenção.
- [~] Histórico real de pagamentos do cliente implementado; falta validar com uma cobrança real.
- [~] Comprovante individual com valor, data, finalidade, estado e referências implementado; falta validar impressão com uma cobrança real.
- [~] Histórico e comprovante de saques da criadora existem parcialmente.
- [x] Informar claramente na página de ajuda o canal por protocolo, o horário do atendimento geral e o prazo de primeira resposta, sem prometer plantão humano ainda inexistente.

Critério de aceite: um usuário deve conseguir resolver acesso, consultar compras e exercer direitos da LGPD sem contato informal com o fundador.

---

## 5. Medição e estabilidade — P1

- [x] Endpoint básico de saúde da aplicação e banco.
- [x] Registrar erros de login, checkout, webhook, moderação e saque no painel operacional.
- [x] Remover dados pessoais e segredos dos eventos de erro.
- [x] Instrumentar o funil: visita → cadastro → perfil → assinatura → renovação.
- [x] Criar indicadores internos de falha por etapa e taxa de conversão por dispositivo.
- [~] Webhook externo para falhas críticas e monitor agendado no GitHub implementados; falta cadastrar o destino e publicar o workflow.
- [~] O workflow do monitor existe na branch de lançamento, mas a execução está bloqueada pelo faturamento do GitHub e ele só ficará ativo após a PR ser validada e mesclada em `main`.
- [~] Comando de backup do banco e de todos os buckets privados implementado com hashes; falta executar em destino criptografado e automatizar no provedor escolhido.
- [ ] Executar restauração em ambiente separado e registrar tempo/resultado.
- [ ] Testar as jornadas críticas no Chrome e Safari para computador.
- [ ] Testar as jornadas críticas em iPhone/Safari e Android/Chrome reais.
- [ ] Testar conexões lentas, QR PIX alternando de aplicativo e retomada após interrupção.
- [~] Teste de carga leve cobre home, login, cadastro, exploração, ajuda e saúde; feed, chat, checkout autenticado e webhook ainda exigem cenário controlado com contas e transações de teste.

`BLOQUEIO EXTERNO`: contas de observabilidade, política de backup e aparelhos reais ou serviço de device farm.

---

## Evidências obrigatórias antes da abertura

- [ ] Planilha ou relatório com cada teste financeiro, IDs e resultado esperado/obtido.
- [ ] Registro de um saque real conciliado.
- [ ] Registro de restauração de backup bem-sucedida.
- [ ] Parecer jurídico e versões finais publicadas das políticas.
- [ ] Lista das criadoras piloto aprovadas e contato operacional.
- [ ] Responsáveis e procedimento de resposta a incidentes.
- [ ] Decisão formal de abrir, adiar ou limitar o MVP com riscos conhecidos.
