# Backup e restauração — procedimento obrigatório

Uma cópia só conta como backup validado depois de ser restaurada em um projeto isolado e testada. A verificação comum do painel administrativo confirma conectividade; ela não substitui este procedimento.

## Frequência mínima

- Backup automático diário do banco e versionamento dos buckets privados.
- Teste de restauração mensal e sempre antes de abrir uma nova versão ao público.
- Retenção mínima proposta: 30 dias para banco, respeitando retenções legais e solicitações LGPD.
- No piloto, acesso restrito ao fundador com MFA; antes de operação contínua, definir um segundo
  custodiante de recuperação, sem compartilhar a chave por mensagem.

## Gerar uma cópia completa

O projeto inclui a Supabase CLI fixada e um exportador que salva banco e objetos do Storage,
calcula hashes SHA-256 e criptografa cada arquivo com AES-256-GCM. A chave nunca é copiada para o
backup. Guarde o backup e a chave em locais diferentes e fora do diretório do Git.

Crie a chave uma única vez e copie-a também para um pendrive ou cofre offline:

```powershell
pnpm backup:key -- --output=C:\FanliraRecovery\fanlira-backup.key
```

Sem essa chave o backup é irrecuperável. Não envie seu conteúdo por chat, e-mail ou GitHub.

```powershell
pnpm backup:production -- --env-file=C:\FanliraRecovery\fanlira-backup.env --key-file=C:\FanliraRecovery\fanlira-backup.key --output=E:\FanliraBackups
```

O arquivo privado informado em `--env-file` precisa conter:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL` (conexão direta do Postgres)

Nunca envie o arquivo de ambiente, a chave ou a pasta gerada ao GitHub. A execução cria arquivos
`.enc` e um `backup-info.json` sem segredos; o conteúdo sensível temporário é removido antes da
conclusão. A geração da cópia não substitui o teste de restauração abaixo.

Para abrir uma cópia em uma pasta isolada e verificar todos os hashes:

```powershell
pnpm backup:decrypt -- --input=E:\FanliraBackups\fanlira-backup-DATA --key-file=C:\FanliraRecovery\fanlira-backup.key --output=C:\FanliraRestoreTest
```

A pasta descriptografada é sensível. Use-a somente no teste, confirme o caminho exato e apague-a
ao final por meio seguro.

## Teste de restauração

1. Escolher um backup fechado, anotar provedor, horário e referência imutável.
2. Descriptografar e verificar hashes com `backup:decrypt`.
3. Criar projeto Supabase isolado sem webhooks, e-mails ou cobranças reais.
4. Restaurar `roles.sql`, `schema.sql`, `data.sql` e objetos privados. Nunca apontar o site público para esse ambiente.
5. Conferir contagens de perfis, publicações, transações, denúncias e chamados.
6. Abrir amostras de arquivos assinados dos buckets `posts`, `stories` e `kyc`, sem baixar material sensível fora da ferramenta autorizada.
7. Validar autenticação, políticas de acesso, leitura de feed e painel administrativo.
8. Destruir o ambiente isolado e a pasta descriptografada conforme a política definida.
9. Registrar o resultado em **Admin → Operação & estabilidade → Registrar evidência**.

## Critério de aprovação

O teste falha se houver diferença injustificada de contagem, arquivo ausente, política de acesso desativada, autenticação inválida ou qualquer integração real ativa. Uma falha abre incidente e impede o lançamento até nova restauração aprovada.
