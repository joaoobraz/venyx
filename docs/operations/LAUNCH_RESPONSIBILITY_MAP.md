# Mapa de responsabilidades para o lançamento

Atualizado em 21/08/2026. Este documento separa desenvolvimento, decisões do fundador e trabalho humano. Nenhum item que dependa de pessoa, dinheiro ou evidência real deve ser marcado como concluído apenas porque existe uma tela.

## 1. Codex — executável sem nova autorização

- Manter build, testes, lint sem erros, varredura de segredos e smoke de produção verdes.
- Corrigir bugs reproduzíveis e publicar ajustes técnicos no Worker da Cloudflare.
- Manter checkout, webhook, conciliação, saque, KYC, moderação, suporte e auditoria protegidos no código.
- Atualizar runbooks, checklist e evidências técnicas sem incluir segredos ou dados pessoais.
- Validar publicamente DNS, HTTPS, cabeçalhos de segurança e endpoint de saúde.
- Preparar os roteiros de piloto, aparelhos, backup, incidente e revisão jurídica.

## 2. Fundador — ação necessária agora

1. **E-mail:** o plano Hostinger atual expira em 06/09/2026. Renovar antes dessa data mantém cadastro, recuperação de senha, suporte e denúncias funcionando; não é uma compra adicional para hoje. A caixa é `no-reply@fanlira.com.br`; `suporte`, `privacidade` e `seguranca` são aliases ativos.
2. **SMTP:** no Supabase, habilitar o SMTP customizado com `smtp.hostinger.com`, porta `465`, TLS/SSL e usuário `no-reply@fanlira.com.br`. A senha deve ser digitada pelo fundador no painel, nunca enviada em conversa ou versionada.
3. **GitHub:** corrigir a autorização do cartão. A conta está em GitHub Free e não possui pagamentos no histórico; o painel informa `Invalid payment method - authorization hold failed`. O workflow não chega a executar enquanto a autorização não for regularizada.
4. **Testes financeiros:** autorizar, um por vez, PIX reais de baixo valor para assinatura, PPV, mimo, chat/upsell e um saque de pelo menos R$ 30. Registrar ID da Impulse Pay, ID Fanlira, horário, valor e resultado.
5. **Backup:** preencher localmente as duas credenciais no arquivo preparado e executar `npm run backup:production -- --env-file=ARQUIVO --key-file=CHAVE --output=DESTINO`. Depois restaurar em ambiente Supabase separado. Nunca enviar chave ou credenciais em conversa.
6. **Escala:** no piloto, o fundador será o revisor único provisório, seguindo os limites de `MANUAL_KYC_AND_MODERATION.md`. Antes de operação contínua, escolher uma segunda pessoa e um contato jurídico/de emergência.
7. **Identificação jurídica:** antes da abertura pública, constituir/manter a representação exigida no Brasil e publicar nome empresarial, documento, endereço e contato do representante nos Termos e atendimento. Os campos técnicos já existem como variáveis `VITE_LEGAL_ENTITY_*`, mas não podem permanecer vazios no lançamento.

## 3. Criadoras do piloto — 5 a 10 pessoas reais

Para cada criadora:

- confirmar identidade, maioridade e titularidade dos documentos;
- aceitar termos, consentimento e política de conteúdo;
- cadastrar perfil, preço, chave PIX e contato operacional;
- enviar a primeira publicação e aguardar moderação;
- testar assinatura, PPV, mimo, chat e pedido de saque;
- confirmar que não existe promessa de ganho e que conteúdo de terceiros ou não consentido é proibido.

A lista individual está em `CREATOR_PILOT_CHECKLIST.md`. O piloto deve permanecer fechado por pelo menos 72 horas antes da abertura pública.

## 4. Operação humana — fundador no piloto, segunda pessoa antes da escala

- Executar o procedimento `MANUAL_KYC_AND_MODERATION.md`; na dúvida, rejeitar ou escalar, nunca aprovar.
- Tratar suspeita de menor, exploração ou conteúdo não consentido imediatamente e preservar evidências.
- No piloto, o fundador cobre diariamente suporte, denúncias, DMCA, conciliação e saques em janela
  publicada e mantém casos inconclusivos bloqueados.
- Uma segunda pessoa treinada passa a ser obrigatória antes de operação contínua, plantão, férias ou
  volume que impeça resposta rápida a denúncias críticas.
- Usar MFA nas contas administrativas e registrar toda decisão no painel.
- Fazer um exercício de incidente com o roteiro `INCIDENT_RESPONSE.md` antes do lançamento.

## 5. Jurídico — profissional brasileiro

- Revisar Termos, Privacidade/LGPD, maioridade, consentimento, conteúdo não consentido, DMCA, consumidor, pagamentos, cancelamento e política de não estorno.
- Devolver textos aprovados, data de vigência e orientação de retenção de dados/evidências.
- Validar a identificação da operadora e do representante no Brasil. A legislação atual torna esse
  ponto requisito pré-lançamento; não deve ser postergado integralmente para a V1.1.

## 6. Fornecedores e dependências externas

- **Impulse Pay:** PIX avulso, consulta, webhook e saque estão integrados. PIX Automático fica aguardando documentação e liberação formal do endpoint, com webhook e idempotência definidos.
- **Hostinger:** renovar o e-mail e concluir a entrega real via SMTP; MX, SPF, DKIM e DMARC já estão publicados.
- **GitHub:** desbloquear faturamento para que os checks possam executar e a PR seja mesclada com evidência verde.
- **Supabase/Cloudflare:** os serviços e segredos já estão conectados; manter acesso com MFA e não compartilhar chaves.

## 7. Ordem objetiva de conclusão

1. SMTP e teste de cadastro/recuperação.
2. GitHub desbloqueado, checks verdes e branch de lançamento mesclada.
3. Fundador treinado para o piloto, contato jurídico/de emergência definido e revisão jurídica concluída.
4. Pagamentos e saque reais com evidências.
5. Backup restaurado e matriz física de aparelhos concluída.
6. Primeira criadora real aprovada para o teste financeiro; depois cinco a dez criadoras e piloto fechado de 72 horas.
7. Reunião final: **abrir**, **adiar** ou **abrir limitado**, registrando riscos conhecidos.
