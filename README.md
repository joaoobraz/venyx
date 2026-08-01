# Venyx

MVP de uma plataforma de assinaturas e conteúdo exclusivo para maiores de 18 anos.

## Executar no computador

Requisitos:

- Node.js 22 LTS ou mais recente
- npm
- Um projeto Supabase configurado

Passos:

1. Duplique `.env.example` com o nome `.env.local`.
2. Preencha as variáveis do Supabase.
3. Para testar pagamentos e rotinas administrativas, preencha também as variáveis
   marcadas como `server-only`.
4. Execute:

```bash
npm ci
npm run dev
```

Abra `http://localhost:8080`.

### Apresentação para investidores

No desenvolvimento local, os 15 perfis de apresentação ficam disponíveis por padrão. A conta
`joaobraz.ofc@gmail.com` também recebe o seletor **Visualizar como**, com as visões de cliente,
modelo e moderador. O seletor altera somente a interface; operações reais continuam protegidas
pelas permissões armazenadas no banco.

Para habilitar a mesma apresentação em um deploy de preview dedicado, configure
`VITE_ENABLE_DEMO_CREATORS=true`, `VITE_ENABLE_DEMO_PREVIEW=true` e mantenha a lista de e-mails
autorizados em `VITE_DEMO_PREVIEW_EMAILS`. Não habilite essas opções no ambiente público final.

No Windows, depois de configurar `.env.local`, você também pode dar dois
cliques em `INICIAR-LOCAL.bat`.

## Verificações antes de publicar

```bash
npm run check
npm audit --omit=dev
```

Nunca publique `.env`, `.env.local`, a chave `SUPABASE_SERVICE_ROLE_KEY`, a chave da
NexusPag ou o segredo das rotinas agendadas.

## Pontos obrigatórios para produção

- Aplicar todas as migrações da pasta `supabase/migrations`.
- Configurar uma verificação real de identidade e idade. A validação matemática de
  CPF é permitida somente no ambiente local e não comprova identidade.
- Configurar `PUBLIC_WEBHOOK_URL` com o domínio final em HTTPS.
- Usar segredos longos e aleatórios para `CRON_SECRET`.
- Manter `ENABLE_PAYMENT_TEST_ENDPOINTS=false`.
- Exigir 2FA para administradores, alterações de chave PIX e saques.
