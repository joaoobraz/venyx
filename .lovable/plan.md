

## Contexto

Hoje o fluxo de pagamento depende de polling manual (`/test-pix` consulta `GET /api/pix/{id}` em loop). Em produção, se o cliente fechar a aba antes da confirmação, **a venda nunca vira transação** e a criadora não recebe o crédito. Além disso, hoje a criadora não fica sabendo quando um saque muda de status — precisa abrir `/creator/wallet` manualmente.

Saque automático via API NexusPag fica fora deste plano (a doc pública não expõe endpoint de PIX out — você vai confirmar com o suporte deles depois).

---

## O que vai ser feito

### 1. Webhook público para receber confirmação da NexusPag

Novo endpoint **`POST /api/public/nexuspag-webhook`** que a NexusPag chamará automaticamente quando um PIX for pago.

Comportamento:
- Recebe o payload (`event: "pix.paid"` com `transaction_id`, `external_id`, `amount`, `paid_at`, etc.).
- Localiza a `pix_charge` pelo `external_id` (já é nosso ID interno, gerado em `nexuspag.functions.ts`).
- Verifica idempotência: se já existe transação para essa cobrança, retorna `200 OK` sem duplicar.
- Cria a `transaction` apropriada (subscription / ppv / tip) com `status='paid'`, e dispara os efeitos colaterais que o `/test-pix` faz hoje (criar `subscription`, `ppv_unlock`, ou `tip` na DB) — extraindo essa lógica para uma função compartilhada.
- Marca a `pix_charge` como `paid`.

### 2. Configurar webhook_url ao criar cobrança

No `nexuspag.functions.ts` (criação do PIX), passar o campo `webhook_url` apontando para a URL pública estável do projeto:
- Produção: `https://project--59549983-d8c7-43dd-bb65-ffb37fd041ca.lovable.app/api/public/nexuspag-webhook`
- Preview: `https://project--59549983-d8c7-43dd-bb65-ffb37fd041ca-dev.lovable.app/api/public/nexuspag-webhook`

### 3. Segurança do webhook

A doc pública da NexusPag não menciona assinatura HMAC explícita. Estratégias defensivas:
- Validar payload com Zod (schema estrito).
- Confirmar a cobrança com `GET /api/pix/{id}` usando nossa `NEXUSPAG_API_KEY` antes de creditar — só credita se a NexusPag confirmar `status=paid` e `amount` bater. Isso impede que qualquer um chame nosso webhook e force créditos falsos.
- Idempotência por `external_id` para evitar replay.

### 4. Notificações in-app de saque

Inserir registros na tabela `notifications` (já existe no projeto) em cada mudança de status de `withdrawal_request`:

| Evento | Mensagem para a criadora |
|---|---|
| `requestWithdrawal` | "Saque de R$ X solicitado. Aguardando aprovação." |
| `approveWithdrawal` | "Saque de R$ X aprovado. Pagamento em processamento." |
| `markWithdrawalPaid` | "Saque de R$ X pago via PIX." (com link do comprovante se houver) |
| `rejectWithdrawal` | "Saque de R$ X rejeitado: {motivo}." |
| `cancelWithdrawal` | (apenas log, é a própria criadora cancelando) |

A criadora já vê notificações no header/sino existente — sem trabalho de UI extra.

### 5. Manter `/test-pix` como ferramenta de debug

Não remover o polling manual — ele continua útil para debug/teste local. Em produção, o webhook será o caminho primário.

---

## Detalhes técnicos

**Arquivos a criar:**
- `src/routes/api.public.nexuspag-webhook.ts` — endpoint público com Zod + verificação cruzada via `GET /api/pix/{id}`.
- `src/server/payments-fulfillment.server.ts` — função `fulfillPaidCharge(chargeId)` extraída do `/test-pix` e do `payments.functions.ts`, idempotente, que cria a `transaction` + efeito colateral (subscription / ppv_unlock / tip).

**Arquivos a editar:**
- `src/server/nexuspag.functions.ts` — adicionar `webhook_url` no payload de criação do PIX (URL derivada de `process.env.PUBLIC_BASE_URL` ou hardcoded com fallback para o domínio estável).
- `src/server/withdrawals.functions.ts` — inserir em `notifications` em `requestWithdrawal`, `approveWithdrawal`, `markWithdrawalPaid`, `rejectWithdrawal`.
- `src/routes/test-pix.tsx` — apenas adicionar um aviso de que o webhook agora confirma automaticamente e o polling é redundante (mas mantido).

**Schema do webhook (Zod):**
```ts
z.object({
  event: z.literal("pix.paid"),
  transaction_id: z.string(),
  txid: z.string().optional(),
  external_id: z.string(),
  status: z.literal("paid"),
  amount: z.number(),
  paid_at: z.string(),
  payer_name: z.string().optional(),
  payer_document_masked: z.string().optional(),
})
```

**Sem migração de banco** — `notifications`, `transactions`, `pix_charges` e `subscriptions/ppv_unlocks/tips` já existem.

---

## Fora do escopo (próximas iterações)

- Saque automático via API NexusPag (aguardando sua confirmação com o suporte deles).
- E-mails transacionais de saque.
- Reserva de chargeback.

