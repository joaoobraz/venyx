# Checklist de abertura do MVP Fanlira

Atualizado em: 02/08/2026

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

Critério de aceite: um pagamento confirmado na NexusPag deve aparecer uma única vez na Fanlira e liberar somente o produto comprado.

### Cancelamento e renovação

- [x] Expiração automática de assinaturas possui job ativo no Supabase a cada hora.
- [x] Rotina manual protegida por `CRON_SECRET` rejeita chamadas ausentes ou incorretas.
- [x] Tela do cliente para listar, cancelar e desfazer o cancelamento de assinaturas.
- [x] Cancelamento programado mantém o acesso até o fim do período contratado.
- [x] O MVP não oferece solicitação ou botão de estorno; cancelamentos encerram somente no vencimento.
- [x] Reversões excepcionais recebidas do provedor continuam conciliadas internamente para impedir acesso ou saldo incorreto.
- [~] Renovação manual por novo PIX e avisos de 7, 3 e 1 dia implementados; agendador configurado e falta validar com uma cobrança real.
- [ ] Definir outro meio/provedor se a decisão comercial exigir renovação automática.

Decisão do MVP: a documentação pública da NexusPag descreve PIX avulso, não cobrança recorrente automática. A renovação inicial será manual. Não haverá fluxo de estorno solicitado pelo usuário no MVP.

### Saldo e saque

- [~] Carteira, saldo disponível/pendente, chave PIX e solicitação de saque existem.
- [x] KYC e 2FA são exigidos no backend para solicitar saque.
- [~] Aprovação, rejeição, marcação como pago e comprovante existem no painel administrativo.
- [ ] Integrar o saque da Fanlira ao endpoint real da NexusPag.
- [ ] Conciliar `cashout.success`, `cashout.failed` e estado `processing`.
- [ ] Executar e comprovar um saque real de baixo valor.

### Webhook e conciliação

- [x] Endpoint de webhook com limite de corpo e assinatura HMAC.
- [x] Janela antirreplay de cinco minutos e comparação em tempo constante.
- [x] Processamento idempotente de pagamento e reversões excepcionais no código.
- [ ] Configurar `NEXUSPAG_API_KEY`, `NEXUSPAG_WEBHOOK_SECRET` e `PUBLIC_WEBHOOK_URL`.
- [ ] Publicar o endpoint em HTTPS e cadastrar a URL na NexusPag.
- [~] Varredura protegida implementada como contingência do webhook; falta configurar a chave real da NexusPag e agendar o endpoint no endereço público.
- [x] Criar painel administrativo de divergências entre NexusPag e Fanlira, com histórico e resolução auditada.

`BLOQUEIO EXTERNO`: credenciais reais NexusPag, URL pública HTTPS e saldo para transações de validação.

---

## 2. Entrada de criadoras reais — P0

### Cadastro e aprovação

- [x] Cadastro por e-mail e recuperação de conta.
- [~] Envio privado de documento, verso e selfie para KYC.
- [~] Painel administrativo para aprovar ou rejeitar KYC.
- [x] Aprovação promove a conta para o papel de criadora no backend.
- [ ] Integrar o KYC NexusPag ou outro provedor de identidade aprovado.
- [ ] Registrar consentimento, versão dos termos, data, IP e evidência de maioridade.

### Conteúdo e monetização

- [~] Upload protegido e moderação antes da publicação existem.
- [~] Preço de assinatura, planos, cupons, PPV e primeira publicação existem.
- [ ] Criar jornada única pós-aprovação: perfil → preço → dados de saque → primeira publicação.
- [ ] Bloquear publicação monetizada até KYC, perfil e chave de saque estarem válidos.
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
- [x] Fila de denúncias, estados de análise e ações administrativas existem.
- [~] Bloqueio, silenciamento, DMCA e auditoria administrativa existem.
- [ ] Criar escala de prioridade e SLA: risco de menor/não consentimento deve ser imediato.
- [ ] Criar procedimento de preservação de evidência e comunicação às autoridades aplicáveis.
- [ ] Treinar ao menos duas pessoas para a fila crítica; nunca depender de uma única pessoa.
- [~] Termos, privacidade e DMCA possuem rascunhos no produto.
- [ ] Substituir e-mails e dados genéricos pelos dados jurídicos reais da empresa.
- [ ] Revisão jurídica brasileira especializada em LGPD, conteúdo adulto, consumidor e pagamentos.

`BLOQUEIO EXTERNO`: contrato com provedor, equipe de moderação e parecer jurídico.

---

## 4. Suporte mínimo e direitos do usuário — P1

- [ ] Página “Preciso de ajuda” com protocolo e categorias.
- [ ] Caixa administrativa de solicitações de suporte.
- [x] Recuperação de senha por e-mail.
- [ ] Fluxo de recuperação quando o usuário perdeu o e-mail ou 2FA.
- [ ] Solicitação autenticada de exportação de dados.
- [ ] Solicitação de exclusão com prazo, confirmação e exceções legais de retenção.
- [~] Histórico real de pagamentos do cliente implementado; falta validar com uma cobrança real.
- [~] Comprovante individual com valor, data, finalidade, estado e referências implementado; falta validar impressão com uma cobrança real.
- [~] Histórico e comprovante de saques da criadora existem parcialmente.
- [ ] Informar claramente canal, horário e prazo de resposta.

Critério de aceite: um usuário deve conseguir resolver acesso, consultar compras e exercer direitos da LGPD sem contato informal com o fundador.

---

## 5. Medição e estabilidade — P1

- [x] Endpoint básico de saúde da aplicação e banco.
- [ ] Integrar registro de erros com alertas de login, checkout, webhook, moderação e saque.
- [ ] Remover dados pessoais e segredos dos eventos de erro.
- [ ] Instrumentar o funil: visita → cadastro → perfil → assinatura → renovação.
- [ ] Criar indicadores de falha por etapa e taxa de conversão por dispositivo.
- [ ] Configurar backup automático do banco e inventário dos buckets privados.
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
