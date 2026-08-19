import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * SECURITY P0:
 * Estes endpoints históricos aceitavam um "mock_token" como prova de pagamento,
 * o que permitia a qualquer usuário autenticado desbloquear conteúdo, fingir
 * assinatura ou enviar gorjeta sem pagar. Foram DESATIVADOS.
 *
 * Todo fluxo de pagamento agora exige uma cobrança Pix real via Impulse Pay —
 * use as funções em `src/_server/checkout.functions.ts` (createSubscriptionPixCharge,
 * createTipPixCharge, etc.). A liberação do conteúdo é feita pelo webhook
 * (`/api/public/impulsepay-webhook`) ou pelo polling de `getChargeStatus`,
 * que chamam `fulfillPaidCharge` em `payments-fulfillment.server.ts`.
 *
 * As funções abaixo continuam exportadas só para que componentes que ainda
 * referenciam esses imports não quebrem em build — qualquer chamada lança um
 * erro claro instruindo o usuário a usar o checkout Pix.
 */

const DISABLED_MSG =
  "Este fluxo foi desativado. O pagamento agora é feito por Pix — use o botão de assinar/comprar para gerar a cobrança.";

// --------- PPV de post ---------
const ppvSchema = z.object({
  postId: z.string().uuid(),
  gatewayToken: z.string().min(1).max(500),
});

export const unlockPpvServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => ppvSchema.parse(input))
  .handler(async (): Promise<{ ok: true; alreadyUnlocked: boolean }> => {
    throw new Error(DISABLED_MSG);
  });

// --------- Tip ---------
const tipSchema = z.object({
  creatorId: z.string().uuid(),
  amountCents: z.number().int().min(100).max(1_000_000),
  postId: z.string().uuid().optional().nullable(),
  message: z.string().max(200).optional().nullable(),
  gatewayToken: z.string().min(1).max(500),
});

export const tipServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => tipSchema.parse(input))
  .handler(async () => {
    throw new Error(DISABLED_MSG);
  });

// --------- Contribuição de meta ---------
const goalSchema = z.object({
  postId: z.string().uuid(),
  gatewayToken: z.string().min(1).max(500),
});

export const contributeGoalServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => goalSchema.parse(input))
  .handler(async () => {
    throw new Error(DISABLED_MSG);
  });

// --------- Assinatura ---------
const subSchema = z.object({
  creatorId: z.string().uuid(),
  months: z.number().int().min(1).max(24),
  pricePerMonthCents: z.number().int().min(0).max(1_000_000),
  couponCode: z.string().max(50).optional().nullable(),
  gatewayToken: z.string().min(1).max(500),
});

export const subscribeServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => subSchema.parse(input))
  .handler(async () => {
    throw new Error(DISABLED_MSG);
  });

// --------- Chat PPV unlock ---------
const chatPpvSchema = z.object({
  messageId: z.string().uuid(),
  gatewayToken: z.string().min(1).max(500),
});

export const unlockChatPpvServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => chatPpvSchema.parse(input))
  .handler(async (): Promise<{ ok: true; alreadyUnlocked: boolean }> => {
    throw new Error(DISABLED_MSG);
  });
