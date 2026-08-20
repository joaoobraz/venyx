# Portões de abertura do MVP

Antes da revisão humana, execute os gates automatizados:

```powershell
pnpm check:release --env-file=.env.production.local --predeploy
```

Depois do deploy, valide a versão efetivamente pública:

```powershell
pnpm smoke:production --url=https://fanlira.com.br
```

Para validar somente o código enquanto as credenciais externas não foram cadastradas:

```powershell
pnpm check:release --code-only
```

Antes de publicar, `pnpm exec wrangler whoami` deve mostrar o Account ID
`77bd53fa8469f1ee770e51db59633e9d`. O arquivo `wrangler.jsonc` fixa essa conta para
impedir que um deploy seja enviado acidentalmente para outra conta Cloudflare.

O Worker deve possuir, no mínimo, os segredos `SUPABASE_SERVICE_ROLE_KEY`,
`IMPULSEPAY_PUBLIC_KEY`, `IMPULSEPAY_SECRET_KEY`, `IMPULSEPAY_WITHDRAWAL_KEY`,
`IMPULSEPAY_WEBHOOK_TOKEN` e `CRON_SECRET`. `OPERATIONS_ALERT_WEBHOOK_URL` é
opcional no MVP: sem ele, os alertas continuam registrados no Supabase, mas não
são encaminhados a um canal externo.

## Pode ser validado localmente

- Build, testes, limites de carga leve e ausência de erros de tipo/lint.
- Responsividade de referência em desktop e viewport mobile.
- Cadastro/KYC/consentimentos, bloqueios de monetização e primeira publicação.
- Denúncias com prioridade, SLA e preservação de evidência.
- Suporte, recuperação, exportação e exclusão como fluxos rastreáveis.
- Funil, alertas e painel operacional sem dados pessoais sensíveis.

## Exige terceiros ou operação real

- Duas pessoas treinadas e escala ativa para KYC e moderação manual.
- Teste financeiro real com o provedor de pagamentos.
- Parecer jurídico.
- Restauração de backup no plano/provedor contratado.
- Teste em iPhone, Android e Safari reais.
- Seleção e validação de 5–10 criadoras reais.

Nenhum item externo deve ser marcado como concluído apenas porque a tela ou o procedimento existe. A abertura pública depende de evidência real registrada.
