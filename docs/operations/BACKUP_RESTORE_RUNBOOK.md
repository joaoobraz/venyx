# Backup e restauração — procedimento obrigatório

Uma cópia só conta como backup validado depois de ser restaurada em um projeto isolado e testada. A verificação comum do painel administrativo confirma conectividade; ela não substitui este procedimento.

## Frequência mínima

- Backup automático diário do banco e versionamento dos buckets privados.
- Teste de restauração mensal e sempre antes de abrir uma nova versão ao público.
- Retenção mínima proposta: 30 dias para banco, respeitando retenções legais e solicitações LGPD.
- Acesso ao backup restrito a duas pessoas autorizadas, com MFA.

## Teste de restauração

1. Escolher um backup fechado, anotar provedor, horário e referência imutável.
2. Criar ambiente isolado sem webhooks, e-mails ou cobranças reais.
3. Restaurar banco e objetos privados. Nunca apontar o site público para esse ambiente.
4. Conferir contagens de perfis, publicações, transações, denúncias e chamados.
5. Abrir amostras de arquivos assinados dos buckets `posts`, `stories` e `kyc`, sem baixar material sensível fora da ferramenta autorizada.
6. Validar autenticação, políticas de acesso, leitura de feed e painel administrativo.
7. Destruir o ambiente isolado conforme a política do provedor.
8. Registrar o resultado em **Admin → Operação & estabilidade → Registrar evidência**.

## Critério de aprovação

O teste falha se houver diferença injustificada de contagem, arquivo ausente, política de acesso desativada, autenticação inválida ou qualquer integração real ativa. Uma falha abre incidente e impede o lançamento até nova restauração aprovada.
