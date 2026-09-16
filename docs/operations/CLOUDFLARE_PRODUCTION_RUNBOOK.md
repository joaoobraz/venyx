# Publicação de produção no Cloudflare

Conta esperada: `77bd53fa8469f1ee770e51db59633e9d`

Worker esperado: `fanlira`

Domínios: `fanlira.com.br` e `www.fanlira.com.br`

## 1. Credenciais

1. Rotacione as chaves da ImpulsePay que já foram compartilhadas e revogue as antigas.
2. Não salve chaves em Git, mensagens, capturas de tela ou comandos que permaneçam no histórico.
3. Reautentique o Wrangler e confirme a conta antes de qualquer deploy:

```powershell
pnpm exec wrangler logout
pnpm exec wrangler login
pnpm exec wrangler whoami
```

O `whoami` precisa exibir exatamente o Account ID acima. O `account_id` também está
fixado no `wrangler.jsonc` como segunda barreira contra publicação na conta errada.

## 2. Segredos obrigatórios do Worker

Cadastre pelo painel Cloudflare, em **Workers e Pages → fanlira → Configurações →
Variáveis e segredos**, sempre com o tipo **Segredo**:

- `SUPABASE_SERVICE_ROLE_KEY`
- `IMPULSEPAY_PUBLIC_KEY`
- `IMPULSEPAY_SECRET_KEY`
- `IMPULSEPAY_WITHDRAWAL_KEY`
- `IMPULSEPAY_WEBHOOK_TOKEN`
- `CRON_SECRET`

`OPERATIONS_ALERT_WEBHOOK_URL` é opcional no MVP. Configure-o quando houver um
canal externo para alertas críticos; os eventos continuam sendo registrados no
Supabase mesmo sem esse webhook.

O token do webhook e o segredo de cron devem ter ao menos 32 caracteres aleatórios.

## 3. CAPTCHA

1. Crie um widget Turnstile gerenciado para `fanlira.com.br` e `www.fanlira.com.br`.
2. Coloque a site key pública em `VITE_TURNSTILE_SITE_KEY` no ambiente de build.
3. No Supabase, abra **Authentication → Attack Protection**, escolha Cloudflare
   Turnstile, informe a secret key e habilite a proteção.
4. Teste cadastro, login e recuperação de senha antes de liberar tráfego.

## 4. Gate e deploy

```powershell
pnpm check:release --env-file=.env.production.local --predeploy
pnpm exec wrangler deploy
pnpm smoke:production --url=https://fanlira.com.br
```

O deploy só está aprovado quando o smoke reportar `service=fanlira`, banco `ok` e
os cabeçalhos de segurança esperados. Execute então pagamentos PIX reais de baixo
valor e um saque real, registrando os IDs no relatório de evidências.
