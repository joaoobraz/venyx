# Checklist de abertura do MVP Fanlira

Atualizado em: 19/08/2026

## Auditoria de prontidão — 19/08/2026

### Validado nesta auditoria

- [x] Projeto Supabase de produção criado e schema-base aplicado.
- [x] Login por e-mail e Google OAuth configurados para `fanlira.com.br` e ambiente local.
- [x] Domínio raiz e `www` respondendo com HTTPS e cabeçalhos de segurança.
- [x] Endpoint público de saúde respondendo com banco conectado.
- [x] Typecheck aprovado.
- [x] 90 testes automatizados aprovados.
- [x] Lint aprovado sem erros (restam avisos de manutenção).
- [x] Build Cloudflare aprovado.
- [x] Teste de carga público aprovado sem falhas nas 120 requisições da amostra.
- [x] Build ajustado para não manter `.dev.vars` no artefato final.
- [x] Deploy configurado para exigir os segredos críticos e bloquear o subdomínio público `workers.dev`.

### Bloqueadores para abrir ao público

- [ ] Rotacionar todas as chaves da ImpulsePay que foram compartilhadas em conversa e revogar as anteriores.
- [ ] Cadastrar no Cloudflare os segredos de produção: `SUPABASE_SERVICE_ROLE_KEY`, chaves ImpulsePay, token do webhook e `CRON_SECRET`.
- [ ] Preencher os dados públicos de produção: razão social/nome legal, CPF/CNPJ, endereço e e-mails operacionais `@fanlira.com.br`.
- [ ] Publicar a versão atual: o `/api/public/health` do domínio ainda identifica o serviço antigo como `venyx`, indicando deploy desatualizado.
- [ ] Configurar SMTP transacional próprio e validar SPF, DKIM, DMARC, confirmação de cadastro e recuperação de senha.
- [~] Turnstile implementado no cadastro, login e recuperação; falta criar as chaves e habilitar a validação no Supabase.
- [ ] Contratar e integrar um provedor real de verificação de identidade/idade; o adaptador de KYC de produção ainda não está disponível.
- [ ] Contratar/configurar moderação de imagem e vídeo que aceite contratualmente conteúdo adulto legal e testar o fluxo de revisão humana.
- [ ] Obter revisão jurídica brasileira dos Termos, Privacidade, conteúdo não consentido, maioridade, DMCA, pagamentos e política de não estorno.
- [ ] Executar e guardar evidências de pagamentos PIX reais: assinatura, PPV, mimo, chat/upsell, webhook idempotente e saque.
- [~] Webhook externo sanitizado, monitor de produção e backup integral foram implementados; faltam credencial/destino e restauração real documentada.
- [ ] Testar fisicamente em iPhone/Safari, Android/Chrome e desktop/Safari, incluindo troca para o aplicativo bancário e retorno do PIX.
- [ ] Cadastrar e aprovar 5–10 criadoras reais, revisar consentimentos e aprovar a primeira publicação de cada uma.
- [ ] Rodar piloto controlado por pelo menos 72 horas antes da abertura pública.
- [x] Histórico Git restaurado sem sobrescrever arquivos; branch local reconectada a `origin/demo-investidores`.
- [x] Conta Cloudflare e Worker existentes auditados: Worker `fanlira`, domínio oficial e logs ativos.
- [ ] Reautenticar o Wrangler deste computador: ele está conectado a outra conta; a conta correta tem ID `77bd53fa8469f1ee770e51db59633e9d`.
- [ ] Completar os bindings do Worker: a implantação atual não possui nenhuma credencial `IMPULSEPAY_*`, token de webhook, Turnstile nem webhook de alerta.
- [~] Security Advisor do Supabase está sem erros, mas reporta 88 avisos; migração final de menor privilégio criada e ainda precisa ser aplicada e seguida de nova varredura.

### Resultado atual

**Ainda não liberar para clientes reais.** A aplicação passa na validação técnica local, porém produção ainda depende de credenciais seguras, novo deploy, fornecedores de KYC/moderação, configuração de e-mail, validação jurídica, testes financeiros e piloto operacional.

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
- [ ] Definir outro meio/provedor se a decisão comercial exigir renovação automática.

Decisão do MVP: assinaturas atuais continuam com renovação manual via PIX. A cobrança recorrente por cartão só será habilitada após concluir checkout, tokenização, 3DS e webhooks de assinatura da Impulse Pay. Não haverá fluxo de estorno solicitado pelo usuário no MVP.

### Saldo e saque

- [~] Carteira, saldo disponível/pendente, chave PIX e solicitação de saque existem.
- [x] KYC e 2FA são exigidos no backend para solicitar saque.
- [~] Aprovação, rejeição, marcação como pago e comprovante existem no painel administrativo.
- [x] Integrar o saque da Fanlira ao endpoint `/v1/transfers` da Impulse Pay.
- [x] Conciliar `withdrawal.processing`, `withdrawal.completed` e `withdrawal.failed` da Impulse Pay.
- [ ] Executar e comprovar um saque real de baixo valor.

### Webhook e conciliação

- [x] Endpoint de webhook com limite de corpo, token secreto em comparação de tempo constante e confirmação autenticada na API da Impulse Pay.
- [x] Não confiar no payload recebido: conferir ID, valor, referência externa e estado diretamente na Impulse Pay antes do fulfillment.
- [x] Processamento idempotente de pagamento e reversões excepcionais no código.
- [ ] Configurar as credenciais `IMPULSEPAY_*` descritas em `.env.example`.
- [ ] Publicar o endpoint em HTTPS e cadastrar a URL com token na Impulse Pay.
- [~] Varredura protegida implementada como contingência do webhook; falta configurar as chaves reais e agendar o endpoint no endereço público.
- [x] Criar painel administrativo de divergências entre Impulse Pay e Fanlira, com histórico e resolução auditada.

`BLOQUEIO EXTERNO`: credenciais reais Impulse Pay, URL pública HTTPS e saldo para transações de validação.

---

## 2. Entrada de criadoras reais — P0

### Cadastro e aprovação

- [x] Cadastro por e-mail e recuperação de conta.
- [~] Envio privado de documento, verso e selfie para KYC.
- [~] Painel administrativo para aprovar ou rejeitar KYC.
- [x] Aprovação promove a conta para o papel de criadora no backend.
- [ ] Integrar um provedor de identidade/KYC aprovado.
- [x] Registrar consentimento, versão dos termos, data, IP e evidência de maioridade.

### Conteúdo e monetização

- [~] Upload protegido e moderação antes da publicação existem.
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

- [~] Moderação preventiva de imagem e amostras de vídeo com bloqueio em caso de falha.
- [ ] Contratar/configurar provedor de moderação que aceite legalmente conteúdo adulto.
- [x] Aviso 18+ bloqueia áreas de conteúdo e mantém ajuda/documentos legais acessíveis.
- [x] Fila de denúncias, estados de análise e ações administrativas existem.
- [~] Bloqueio, silenciamento, DMCA e auditoria administrativa existem.
- [x] Criar escala de prioridade e SLA: risco de menor/não consentimento deve ser imediato.
- [x] Criar procedimento de preservação de evidência e comunicação às autoridades aplicáveis.
- [ ] Treinar ao menos duas pessoas para a fila crítica; nunca depender de uma única pessoa.
- [~] Termos, privacidade e DMCA possuem rascunhos no produto.
- [~] Contatos foram migrados para `@fanlira.com.br`; faltam dados da pessoa jurídica e ativação das caixas de e-mail.
- [ ] Revisão jurídica brasileira especializada em LGPD, conteúdo adulto, consumidor e pagamentos.

`BLOQUEIO EXTERNO`: contrato com provedor, equipe de moderação e parecer jurídico.

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
- [ ] Informar claramente canal, horário e prazo de resposta.

Critério de aceite: um usuário deve conseguir resolver acesso, consultar compras e exercer direitos da LGPD sem contato informal com o fundador.

---

## 5. Medição e estabilidade — P1

- [x] Endpoint básico de saúde da aplicação e banco.
- [x] Registrar erros de login, checkout, webhook, moderação e saque no painel operacional.
- [x] Remover dados pessoais e segredos dos eventos de erro.
- [x] Instrumentar o funil: visita → cadastro → perfil → assinatura → renovação.
- [x] Criar indicadores internos de falha por etapa e taxa de conversão por dispositivo.
- [~] Webhook externo para falhas críticas e monitor agendado no GitHub implementados; falta cadastrar o destino e publicar o workflow.
- [~] Comando de backup do banco e de todos os buckets privados implementado com hashes; falta executar em destino criptografado e automatizar no provedor escolhido.
- [ ] Executar restauração em ambiente separado e registrar tempo/resultado.
- [ ] Testar as jornadas críticas no Chrome e Safari para computador.
- [ ] Testar as jornadas críticas em iPhone/Safari e Android/Chrome reais.
- [ ] Testar conexões lentas, QR PIX alternando de aplicativo e retomada após interrupção.
- [ ] Fazer teste de carga leve no feed, chat, checkout e webhook.

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
