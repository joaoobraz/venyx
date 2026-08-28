# Fanlira — liberação do PIX em produção

Este roteiro só considera o PIX pronto quando uma cobrança real é paga, confirmada pela Impulse Pay e liberada uma única vez na Fanlira. Build local ou QR Code gerado não substituem essa prova.

## 1. Decisões que precisam ser confirmadas

- Marca e domínio oficiais confirmados: **Fanlira**, em `https://fanlira.com.br`, com `https://www.fanlira.com.br` como domínio adicional.
- Criar um projeto Supabase exclusivo de produção. O projeto `uzbdzklsufweldmfbvfq` está documentado como staging e não deve ser promovido por acidente.
- Girar as chaves da Impulse Pay que tenham sido compartilhadas em chat ou outro canal não apropriado para segredos.

## 2. Banco e autenticação

1. Criar o projeto de produção no Supabase e configurar login por e-mail e Google com o domínio oficial.
   O Project Reference pode ser copiado da URL `https://supabase.com/dashboard/project/PROJECT_REF` ou em **Project Settings → General**.
2. Vincular o CLI ao projeto correto.
3. Executar `supabase db push --dry-run` e revisar todas as migrações.
4. Executar `supabase db push` somente depois da revisão.
5. Confirmar que nome completo, CPF validado, telefone com DDD e e-mail do comprador estão salvos na conta. A Fanlira envia esses dados à Impulse Pay; não pede que o usuário os digite novamente no checkout.

## 3. Segredos e build

- Configurar no servidor/hospedagem todas as variáveis de `.env.example`.
- Ativar e testar as caixas operacionais `@fanlira.com.br` antes do deploy. Os campos `VITE_LEGAL_*` ficam opcionais na V1.0 e serão completados na V1.1.
- Nunca expor `SUPABASE_SERVICE_ROLE_KEY`, `IMPULSEPAY_SECRET_KEY`, `IMPULSEPAY_WITHDRAWAL_KEY`, `IMPULSEPAY_WEBHOOK_TOKEN` ou `CRON_SECRET` com prefixo `VITE_`.
- Manter todos os modos demo e endpoints de teste desativados em produção.
- Rodar `npm run check:prod-env -- --env-file=ARQUIVO_PRIVADO` antes da publicação. A checagem só mostra nomes ausentes, nunca valores.
- Rodar `npm run build:cloudflare` para gerar o artefato Cloudflare.

## 4. Webhook e rotinas

1. Publicar a aplicação em HTTPS.
2. Configurar `IMPULSEPAY_WEBHOOK_URL` como `https://fanlira.com.br/api/public/impulsepay-webhook` e um `IMPULSEPAY_WEBHOOK_TOKEN` aleatório.
3. Cadastrar no painel da Impulse Pay a URL completa devolvida pela configuração, com o mesmo token na query string.
4. Agendar a reconciliação PIX e as rotinas de expiração/lembrete usando `CRON_SECRET`.
5. Confirmar que chamadas sem token retornam `401` e que payload inválido retorna `400` sem alterar saldo ou acesso.

## 5. Teste financeiro obrigatório

Usar contas reais de teste, sem enviar CPF ou chaves pelo chat:

1. Criar uma assinatura PIX de baixo valor, pagar e verificar liberação única.
2. Comprar um PPV, pagar e verificar liberação apenas daquele conteúdo.
3. Enviar um mimo, pagar e verificar crédito único no saldo da criadora.
4. Solicitar um saque baixo e acompanhar `processing` até `completed` ou `failed`.
5. Reenviar o mesmo webhook e confirmar que não duplica assinatura, acesso, mimo ou saldo.
6. Fechar o navegador antes de um pagamento e confirmar que o webhook libera o item sem depender do polling da tela.

## 6. Limite atual do produto

O PIX atual é automático para criar a cobrança e reconhecer o pagamento. A renovação de assinatura por PIX ainda exige uma nova cobrança. Débito recorrente por PIX Automático depende de um endpoint de mandato/recorrência que não aparece na documentação fornecida pela Impulse Pay; não deve ser prometido até a adquirente confirmar suporte.

## Critério de abertura

Abrir primeiro para compradores convidados e poucas criadoras verificadas. Manter o piloto por pelo menos 72 horas e interromper novas cobranças se houver divergência de valor, duplicidade, liberação incorreta, falha do webhook ou problema de moderação.
