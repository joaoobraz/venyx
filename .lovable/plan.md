
## O que vai mudar

1. **Botão "Assinar" passa a cobrar de verdade via Pix (NexusPag)** — hoje o `SubscribeModal` usa um `mock_token` e ativa a assinatura na hora. Vou trocar pelo fluxo Pix real (igual já roda em `test-pix`): gera QR Code, mostra no modal, e a assinatura só é ativada quando o webhook confirma o pagamento.
2. **Texto "Assinar por R$ X" → "ASSINAR"** no card do perfil (mantém o preço numa linha separada abaixo, pra ficar elegante).
3. **Order Bump no checkout** — antes de gerar o Pix, a criadora pode ter 1-3 ofertas extras marcáveis (ex: "+ Pack 10 fotos R$ 19", "+ Vídeo exclusivo R$ 29"). Se marcar, soma no Pix único.
4. **One-Click Upsell pós-pagamento** — assim que o webhook confirma a assinatura, o app detecta e mostra UMA tela de oferta especial ("Aproveite e leve este pack VIP por R$ Y — só agora"). 1 clique gera novo Pix; recusar segue para o feed.
5. **Painel da criadora pra cadastrar bumps e upsell** — nova aba `/creator/upsells` com CRUD (título, descrição, preço, mídia opcional, tipo: bump ou upsell, ativo sim/não).

> **Regra anti-evasão já embutida:** as ofertas só aceitam título/descrição/mídia hospedada na própria plataforma. Vou bloquear no servidor qualquer texto que contenha `http://`, `https://`, `wa.me`, `t.me`, `@usuario` (telegram/insta), número de telefone com formato BR/intl, ou e-mail. Se a criadora tentar salvar "WhatsApp", "Telegram", "Privacy", etc., recusa com mensagem clara.

---

## Fluxo visual

```text
[Perfil] → [ASSINAR] → Modal escolhe plano (1/3/6/12 m)
                       ↓
                       Tela de bumps (checkboxes) — só se a criadora tiver ofertas ativas
                       ↓
                       [Pagar com Pix] → QR Code (1 cobrança = plano + bumps marcados)
                                          ↓ webhook NexusPag confirma
                                          ↓ assinatura ativa + bumps entregues
                                          ↓
                                          Tela "Oferta especial" (upsell) — 1 só
                                          ├─ Sim → novo Pix do upsell → entrega
                                          └─ Não obrigado → /feed
```

---

## Mudanças no banco

Migration nova com 2 tabelas + 1 enum:

```sql
CREATE TYPE upsell_offer_kind AS ENUM ('order_bump','post_purchase_upsell');

CREATE TABLE upsell_offers (
  id uuid PK,
  creator_id uuid NOT NULL,
  kind upsell_offer_kind NOT NULL,
  title text NOT NULL,             -- max 60 chars
  description text,                 -- max 280
  price_cents int NOT NULL CHECK (price_cents >= 100),
  media_post_id uuid NULL,          -- opcional: aponta pra um post existente da criadora
  is_active bool DEFAULT true,
  position int DEFAULT 0,
  created_at, updated_at
);

CREATE TABLE upsell_purchases (
  id uuid PK,
  offer_id uuid NOT NULL,
  buyer_id uuid NOT NULL,
  creator_id uuid NOT NULL,
  pix_charge_id uuid,               -- liga à pix_charges
  amount_cents int NOT NULL,
  status text DEFAULT 'pending',    -- pending|paid
  origin text NOT NULL,             -- 'bump' | 'upsell'
  parent_charge_id uuid NULL,       -- a assinatura que originou (pra rastreio)
  created_at, paid_at
);
```

RLS:
- `upsell_offers`: SELECT público (qualquer um vê pra exibir no checkout); INSERT/UPDATE/DELETE só `creator_id = auth.uid()` + role creator.
- `upsell_purchases`: SELECT pelo comprador OU pela criadora; INSERT só servidor (via service role no fulfillment).

Adiciona o purpose `'upsell'` no enum `pix_purpose` (se ainda não existir, ajusta) — fulfillment trata como "entregar a oferta": cria `upsell_purchases.status=paid` e, se a oferta apontar pra um `media_post_id`, insere em `ppv_unlocks` automaticamente.

---

## Mudanças no código

**Server functions novas (`src/server/upsells.functions.ts`):**
- `listOffersForCreator(creatorId, kind)` — público, retorna ofertas ativas pro checkout.
- `upsertOffer({ id?, kind, title, description, price_cents, media_post_id })` — auth + role creator + **validação anti-link/contato** (regex bloqueia URL, @, telefone, email).
- `deleteOffer(id)`.
- `createSubscriptionPixCharge({ creatorId, months, pricePerMonth, couponCode, bumpOfferIds[] })` — substitui o mock atual: soma valor da assinatura + bumps, cria 1 `pix_charges` com `purpose='subscription'` e `metadata={ months, coupon, bumps:[ids] }`, chama NexusPag, devolve QR.
- `createUpsellPixCharge({ offerId })` — gera Pix individual do upsell pós-pagamento.
- `getOfferedUpsell(creatorId)` — retorna 1 oferta `post_purchase_upsell` ativa (a primeira por `position`) pra mostrar na tela one-click.

**Server fulfillment (`payments-fulfillment.server.ts`):**
- `fulfillSubscription` passa a ler `metadata.bumps[]` e cria 1 `upsell_purchases` paid + `ppv_unlocks` pra cada bump que tenha `media_post_id`.
- Novo case `'upsell'` no switch do `fulfillPaidCharge`.

**UI:**
- `src/components/SubscribeModal.tsx` — refeito em 3 passos:
  1. Escolher plano + cupom (mantém visual atual).
  2. Bumps (só renderiza se houver ofertas ativas; checkboxes; mostra total acumulado).
  3. Pix QR Code com polling do status (igual `test-pix`); ao virar `paid`, fecha modal e dispara o `UpsellModal`.
- `src/components/UpsellModal.tsx` — **novo**. Aparece 1 vez por compra. CTA grande "Sim, quero!" + link discreto "Não, obrigado". Sim → gera Pix do upsell e mostra QR. Não → fecha e segue.
- `src/routes/profile.$username.tsx` — troca `t("profile.subscribe")` (que renderiza "Assinar por R$ X") por **"ASSINAR"** em caps; preço some do botão e fica numa label abaixo "R$ X,XX/mês a partir de".
- `src/lib/i18n.tsx` — `profile.subscribe` vira `"ASSINAR"`; nova chave `profile.subscribe_price_hint` = `"a partir de R$ {price}/mês"`.
- `src/routes/creator.upsells.tsx` — **nova rota**. Lista ofertas, botão "Nova oferta" com modal (tipo, título, descrição, preço, opcional anexar a um post existente como entrega). Atalho no Sidebar do criador.

---

## Validação anti-evasão (servidor)

Função `assertNoExternalContact(text: string)` rejeita se bater em qualquer:
- `/(https?:\/\/|www\.)/i`
- `/\b(wa\.me|t\.me|telegram|whatsapp|instagram\.com|tiktok\.com|onlyfans)/i`
- `/@[a-z0-9_.]{3,}/i` (handles)
- `/\+?\d{2}[\s.-]?\(?\d{2}\)?[\s.-]?\d{4,5}[\s.-]?\d{4}/` (telefone)
- email regex

Aplicada em `title` e `description` no `upsertOffer`. Mensagem de erro: *"Ofertas não podem conter links, redes sociais, telefone ou e-mail. Toda entrega precisa rolar dentro da plataforma."*

---

## Pontos de atenção

- O webhook NexusPag já existe e está funcionando (testado no fluxo anterior). Vou só estender o `fulfillment` pra entender bumps + upsell.
- A assinatura só ativa após webhook → enquanto o usuário não pagar, não vê conteúdo de assinante. Isso é uma **mudança de comportamento real** vs. o mock atual (que ativava na hora). É o correto pra produção.
- Cupom de trial (R$ 0) continua funcionando: nesse caso pula o Pix e ativa direto, igual hoje.
- Order bump e upsell **não** geram comissão de afiliado por enquanto (escopo futuro) — só a assinatura base entra na trilha de afiliado.
- Tela one-click upsell fica disponível por 10 min após o pagamento (via flag em localStorage + verificação no servidor de quando a assinatura foi criada).

---

## Arquivos tocados

- **novo**: `supabase/migrations/<timestamp>_upsells.sql`
- **novo**: `src/server/upsells.functions.ts`
- **novo**: `src/components/UpsellModal.tsx`
- **novo**: `src/routes/creator.upsells.tsx`
- editado: `src/components/SubscribeModal.tsx` (refeito em 3 passos com Pix real)
- editado: `src/server/payments-fulfillment.server.ts` (bumps + case upsell)
- editado: `src/server/payments.functions.ts` (remove mock de assinatura ou marca como deprecated)
- editado: `src/routes/profile.$username.tsx` (botão "ASSINAR")
- editado: `src/lib/i18n.tsx` (textos)
- editado: `src/components/Sidebar.tsx` (link "Upsells & Bumps")
