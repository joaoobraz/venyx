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

1. **E-mail:** renovar o plano Hostinger antes de 06/09/2026. A caixa é `no-reply@fanlira.com.br`; `suporte`, `privacidade` e `seguranca` são aliases ativos. Não é necessário comprar outra caixa no MVP: denúncias usam `seguranca` e DMCA usa `privacidade`.
2. **SMTP:** no Supabase, habilitar o SMTP customizado com `smtp.hostinger.com`, porta `465`, TLS/SSL e usuário `no-reply@fanlira.com.br`. A senha deve ser digitada pelo fundador no painel, nunca enviada em conversa ou versionada.
3. **GitHub:** regularizar a cobrança da conta. O workflow não chega a executar: o run `32363880725` informa que a conta está bloqueada por cobrança.
4. **Testes financeiros:** autorizar, um por vez, PIX reais de baixo valor para assinatura, PPV, mimo, chat/upsell e um saque de pelo menos R$ 30. Registrar ID da Impulse Pay, ID Fanlira, horário, valor e resultado.
5. **Backup:** escolher um destino criptografado fora do servidor, fornecer localmente a URL direta do banco e executar `npm run backup:production -- --env-file=ARQUIVO --output=DESTINO`. Depois restaurar em ambiente separado.
6. **Escala:** escolher telefone e duas pessoas para incidentes, suporte, KYC e moderação.

## 3. Criadoras do piloto — 5 a 10 pessoas reais

Para cada criadora:

- confirmar identidade, maioridade e titularidade dos documentos;
- aceitar termos, consentimento e política de conteúdo;
- cadastrar perfil, preço, chave PIX e contato operacional;
- enviar a primeira publicação e aguardar moderação;
- testar assinatura, PPV, mimo, chat e pedido de saque;
- confirmar que não existe promessa de ganho e que conteúdo de terceiros ou não consentido é proibido.

A lista individual está em `CREATOR_PILOT_CHECKLIST.md`. O piloto deve permanecer fechado por pelo menos 72 horas antes da abertura pública.

## 4. Equipe operacional — mínimo de duas pessoas

- Executar o procedimento `MANUAL_KYC_AND_MODERATION.md`; na dúvida, rejeitar ou escalar, nunca aprovar.
- Tratar suspeita de menor, exploração ou conteúdo não consentido imediatamente e preservar evidências.
- Cobrir diariamente suporte, denúncias, DMCA, conciliação e saques.
- Usar MFA nas contas administrativas e registrar toda decisão no painel.
- Fazer um exercício de incidente com o roteiro `INCIDENT_RESPONSE.md` antes do lançamento.

## 5. Jurídico — profissional brasileiro

- Revisar Termos, Privacidade/LGPD, maioridade, consentimento, conteúdo não consentido, DMCA, consumidor, pagamentos, cancelamento e política de não estorno.
- Devolver textos aprovados, data de vigência e orientação de retenção de dados/evidências.
- Razão social, CPF/CNPJ e endereço público permanecem planejados para a V1.1 por decisão do fundador; o risco deve ser aceito por escrito pelo jurídico antes da abertura.

## 6. Fornecedores e dependências externas

- **Impulse Pay:** PIX avulso, consulta, webhook e saque estão integrados. PIX Automático fica aguardando documentação e liberação formal do endpoint, com webhook e idempotência definidos.
- **Hostinger:** renovar o e-mail e concluir a entrega real via SMTP; MX, SPF, DKIM e DMARC já estão publicados.
- **GitHub:** desbloquear faturamento para que os checks possam executar e a PR seja mesclada com evidência verde.
- **Supabase/Cloudflare:** os serviços e segredos já estão conectados; manter acesso com MFA e não compartilhar chaves.

## 7. Ordem objetiva de conclusão

1. SMTP e teste de cadastro/recuperação.
2. GitHub desbloqueado, checks verdes e branch de lançamento mesclada.
3. Duas pessoas treinadas e revisão jurídica concluída.
4. Pagamentos e saque reais com evidências.
5. Backup restaurado e matriz física de aparelhos concluída.
6. Cinco a dez criadoras aprovadas e piloto fechado de 72 horas.
7. Reunião final: **abrir**, **adiar** ou **abrir limitado**, registrando riscos conhecidos.
