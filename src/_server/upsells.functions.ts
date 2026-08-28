import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Order Bumps & One-Click Upsells
 *
 * Regras:
 * - Apenas criadoras criam/editam ofertas (RLS valida + checagem aqui).
 * - Conteúdo das ofertas NÃO pode conter links externos, redes sociais,
 *   telefones ou e-mails — toda entrega precisa ficar dentro da plataforma.
 *   (Política da plataforma; bloqueia evasão de leads.)
 * - A entrega real (criar ppv_unlocks etc.) acontece em payments-fulfillment
 *   após o webhook da Impulse Pay confirmar o pagamento.
 */

// =====================================================
// Anti-evasão
// =====================================================
const BANNED_PATTERNS: { re: RegExp; reason: string }[] = [
  { re: /(https?:\/\/|www\.)/i, reason: "links externos" },
  { re: /\b(wa\.me|t\.me|telegram|whatsapp|zap|insta(gram)?|tiktok|onlyfans|privacy|fanvue)\b/i, reason: "redes sociais ou plataformas externas" },
  { re: /@[a-z0-9_.]{3,}/i, reason: "@usuário" },
  { re: /\+?\d{2}[\s.-]?\(?\d{2,3}\)?[\s.-]?\d{4,5}[\s.-]?\d{4}/, reason: "telefone" },
  { re: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i, reason: "e-mail" },
];

function assertNoExternalContact(...texts: (string | null | undefined)[]): void {
  for (const text of texts) {
    if (!text) continue;
    for (const { re, reason } of BANNED_PATTERNS) {
      if (re.test(text)) {
        throw new Error(
          `Ofertas não podem conter ${reason}. Toda entrega precisa rolar dentro da plataforma.`,
        );
      }
    }
  }
}

// =====================================================
// Listar ofertas (público, usado no checkout)
// =====================================================
const listSchema = z.object({
  creatorId: z.string().uuid(),
  kind: z.enum(["order_bump", "post_purchase_upsell"]),
});

export const listCreatorOffers = createServerFn({ method: "POST" })
  .validator((input: unknown) => listSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: offers, error } = await supabaseAdmin
      .from("upsell_offers")
      .select("id, kind, title, description, price_cents, media_post_id, position")
      .eq("creator_id", data.creatorId)
      .eq("kind", data.kind)
      .eq("is_active", true)
      .order("position", { ascending: true })
      .limit(data.kind === "order_bump" ? 3 : 1);

    if (error) {
      console.error("[upsells] list", error);
      return { offers: [] };
    }
    return { offers: offers ?? [] };
  });

// =====================================================
// CRUD pela criadora
// =====================================================
const upsertSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  kind: z.enum(["order_bump", "post_purchase_upsell"]),
  title: z.string().trim().min(1).max(60),
  description: z.string().trim().max(280).optional().nullable(),
  price_cents: z.number().int().min(100).max(1_000_000),
  media_post_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().default(true),
  position: z.number().int().min(0).max(99).default(0),
});

export const upsertOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => upsertSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // Confirma role creator
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (!(roles ?? []).some((r) => r.role === "creator")) {
      throw new Error("Apenas criadoras podem cadastrar ofertas");
    }

    // Anti-evasão
    assertNoExternalContact(data.title, data.description);

    // Se referenciar media_post_id, precisa ser post da própria criadora
    if (data.media_post_id) {
      const { data: post } = await supabaseAdmin
        .from("posts")
        .select("creator_id")
        .eq("id", data.media_post_id)
        .maybeSingle();
      if (!post || post.creator_id !== userId) {
        throw new Error("Post de entrega inválido");
      }
    }

    if (data.id) {
      // update
      const { error } = await supabaseAdmin
        .from("upsell_offers")
        .update({
          kind: data.kind,
          title: data.title,
          description: data.description ?? null,
          price_cents: data.price_cents,
          media_post_id: data.media_post_id ?? null,
          is_active: data.is_active,
          position: data.position,
        })
        .eq("id", data.id)
        .eq("creator_id", userId);
      if (error) throw new Error("Falha ao atualizar oferta");
      return { ok: true, id: data.id };
    }

    // Limita 3 bumps + 1 upsell ativo
    if (data.is_active) {
      const { count } = await supabaseAdmin
        .from("upsell_offers")
        .select("id", { count: "exact", head: true })
        .eq("creator_id", userId)
        .eq("kind", data.kind)
        .eq("is_active", true);
      const max = data.kind === "order_bump" ? 3 : 1;
      if ((count ?? 0) >= max) {
        throw new Error(
          data.kind === "order_bump"
            ? "Máximo de 3 order bumps ativos"
            : "Máximo de 1 upsell pós-pagamento ativo",
        );
      }
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("upsell_offers")
      .insert({
        creator_id: userId,
        kind: data.kind,
        title: data.title,
        description: data.description ?? null,
        price_cents: data.price_cents,
        media_post_id: data.media_post_id ?? null,
        is_active: data.is_active,
        position: data.position,
      })
      .select("id")
      .single();
    if (error || !inserted) throw new Error("Falha ao criar oferta");
    return { ok: true, id: inserted.id };
  });

const deleteSchema = z.object({ id: z.string().uuid() });

export const deleteOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => deleteSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin
      .from("upsell_offers")
      .delete()
      .eq("id", data.id)
      .eq("creator_id", context.userId);
    if (error) throw new Error("Falha ao remover oferta");
    return { ok: true };
  });

// =====================================================
// Checa se há upsell pós-pagamento elegível para o comprador
// (chamado depois que a assinatura é confirmada)
// =====================================================
const eligibleSchema = z.object({ creatorId: z.string().uuid() });

export const getEligiblePostPurchaseUpsell = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => eligibleSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // Precisa ter assinatura ativa nos últimos 30 min (= acabou de pagar)
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("id, created_at")
      .eq("subscriber_id", userId)
      .eq("creator_id", data.creatorId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub) return { offer: null };
    const ageMs = Date.now() - new Date(sub.created_at).getTime();
    if (ageMs > 30 * 60 * 1000) return { offer: null };

    // Já comprou algum upsell desta criadora hoje? (evita oferecer 2x)
    const { count } = await supabaseAdmin
      .from("upsell_purchases")
      .select("id", { count: "exact", head: true })
      .eq("buyer_id", userId)
      .eq("creator_id", data.creatorId)
      .eq("origin", "upsell")
      .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
    if ((count ?? 0) > 0) return { offer: null };

    const { data: offer } = await supabaseAdmin
      .from("upsell_offers")
      .select("id, title, description, price_cents, media_post_id")
      .eq("creator_id", data.creatorId)
      .eq("kind", "post_purchase_upsell")
      .eq("is_active", true)
      .order("position")
      .limit(1)
      .maybeSingle();

    return { offer: offer ?? null };
  });
