import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdultVerification } from "@/_server/access-control.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertRateLimit } from "@/_server/rate-limit.server";
import { assertCreatorCanMonetize, callImpulsePay } from "@/_server/checkout-core.server";

/**
 * Pedidos personalizados (conteúdo sob encomenda). Todas as escritas passam
 * por aqui com service role; o cliente só lê custom_requests via RLS.
 * Padrão: nunca lançar de dentro do handler — devolver { ok:false, error }.
 */

type RequestRow = {
  id: string;
  creator_id: string;
  fan_id: string;
  description: string;
  amount_cents: number;
  status: "pending" | "accepted" | "paid" | "delivered" | "declined" | "cancelled";
  creator_note: string | null;
  charge_id: string | null;
  created_at: string;
  updated_at: string;
  responded_at: string | null;
  paid_at: string | null;
  delivered_at: string | null;
};

type Settings = { enabled: boolean; min_price_cents: number; instructions: string };
const DEFAULT_SETTINGS: Settings = { enabled: false, min_price_cents: 5000, instructions: "" };

const fmtBRL = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
const fail = (error: string) => ({ ok: false as const, error });

async function notify(userId: string, title: string, body: string, link: string, metadata: Record<string, unknown>) {
  const { error } = await supabaseAdmin.from("notifications").insert({
    user_id: userId,
    type: "custom_request",
    title,
    body,
    link,
    metadata: metadata as never,
  });
  if (error) console.error("[custom-requests.notify]", error.code);
}

async function displayNameOf(userId: string) {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("display_name, username")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.display_name || data?.username || "Alguém";
}

async function isCreator(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "creator")
    .maybeSingle();
  return !!data;
}

async function loadRequest(id: string): Promise<RequestRow | null> {
  const { data } = await supabaseAdmin.from("custom_requests" as never).select("*").eq("id", id).maybeSingle();
  return (data as unknown as RequestRow) ?? null;
}

// ---------------------------------------------------------------- settings
export const getCreatorRequestSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ creatorId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { data: row } = await supabaseAdmin
      .from("creator_request_settings" as never)
      .select("enabled, min_price_cents, instructions")
      .eq("creator_id", data.creatorId)
      .maybeSingle();
    return ((row as unknown as Settings) ?? DEFAULT_SETTINGS) as Settings;
  });

const settingsSchema = z.object({
  enabled: z.boolean(),
  min_price_cents: z.number().int().min(100).max(1_000_000),
  instructions: z.string().max(600),
});

export const upsertMyRequestSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => settingsSchema.parse(input))
  .handler(async ({ data, context }) => {
    if (!(await isCreator(context.userId))) return fail("Apenas criadoras podem ativar pedidos personalizados.");
    const { error } = await supabaseAdmin.from("creator_request_settings" as never).upsert(
      {
        creator_id: context.userId,
        enabled: data.enabled,
        min_price_cents: data.min_price_cents,
        instructions: data.instructions.trim(),
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "creator_id" },
    );
    if (error) {
      console.error("[custom-requests.settings]", error.code, error.message);
      return fail("Não foi possível salvar as configurações de pedidos.");
    }
    return { ok: true as const };
  });

// ---------------------------------------------------------------- fã cria
const createSchema = z.object({
  creatorId: z.string().uuid(),
  description: z.string().trim().min(10).max(1000),
  amountCents: z.number().int().min(100).max(1_000_000),
});

export const createCustomRequest = createServerFn({ method: "POST" })
  .middleware([requireAdultVerification])
  .validator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    const fanId = context.userId;
    if (data.creatorId === fanId) return fail("Você não pode fazer um pedido para si mesma.");

    const { data: settingsRow } = await supabaseAdmin
      .from("creator_request_settings" as never)
      .select("enabled, min_price_cents")
      .eq("creator_id", data.creatorId)
      .maybeSingle();
    const settings = settingsRow as unknown as Settings | null;
    if (!settings?.enabled) return fail("Esta criadora não está aceitando pedidos personalizados no momento.");
    if (data.amountCents < settings.min_price_cents) {
      return fail(`O valor mínimo para pedidos desta criadora é ${fmtBRL(settings.min_price_cents)}.`);
    }

    const { data: blocked } = await supabaseAdmin.rpc("users_are_blocked", {
      _user_a: data.creatorId,
      _user_b: fanId,
    });
    if (blocked) return fail("Não é possível enviar pedidos para esta criadora.");

    try {
      await assertRateLimit(`custom-request:${fanId}`, 5, 3600, "Muitos pedidos em pouco tempo. Aguarde um pouco e tente de novo.");
    } catch (e) {
      return fail(e instanceof Error ? e.message : "Muitos pedidos em pouco tempo.");
    }

    const { data: created, error } = await supabaseAdmin
      .from("custom_requests" as never)
      .insert({
        creator_id: data.creatorId,
        fan_id: fanId,
        description: data.description,
        amount_cents: data.amountCents,
        status: "pending",
      } as never)
      .select("id")
      .single();
    if (error || !created) {
      console.error("[custom-requests.create]", error?.code, error?.message);
      return fail("Não foi possível enviar o pedido. Tente novamente.");
    }

    const fanName = await displayNameOf(fanId);
    await notify(
      data.creatorId,
      "Novo pedido personalizado",
      `${fanName} ofereceu ${fmtBRL(data.amountCents)}: "${data.description.slice(0, 120)}${data.description.length > 120 ? "…" : ""}"`,
      "/creator/requests",
      { request_id: (created as { id: string }).id },
    );
    return { ok: true as const, id: (created as { id: string }).id };
  });

// ---------------------------------------------------------------- criadora responde
const respondSchema = z.object({
  requestId: z.string().uuid(),
  action: z.enum(["accept", "decline"]),
  note: z.string().trim().max(500).optional(),
  amountCents: z.number().int().min(100).max(1_000_000).optional(),
});

export const respondCustomRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => respondSchema.parse(input))
  .handler(async ({ data, context }) => {
    const req = await loadRequest(data.requestId);
    if (!req || req.creator_id !== context.userId) return fail("Pedido não encontrado.");
    if (req.status !== "pending") return fail("Este pedido já foi respondido.");

    const nextStatus = data.action === "accept" ? "accepted" : "declined";
    const amount = data.action === "accept" && data.amountCents ? data.amountCents : req.amount_cents;
    const { error } = await supabaseAdmin
      .from("custom_requests" as never)
      .update({
        status: nextStatus,
        amount_cents: amount,
        creator_note: data.note?.trim() || null,
        responded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", req.id)
      .eq("status", "pending");
    if (error) {
      console.error("[custom-requests.respond]", error.code, error.message);
      return fail("Não foi possível responder o pedido.");
    }

    const creatorName = await displayNameOf(req.creator_id);
    if (nextStatus === "accepted") {
      await notify(
        req.fan_id,
        "Pedido aceito! 🎉",
        `${creatorName} aceitou seu pedido por ${fmtBRL(amount)}${amount !== req.amount_cents ? " (valor ajustado)" : ""}. Pague para ela começar.`,
        "/requests",
        { request_id: req.id },
      );
    } else {
      await notify(
        req.fan_id,
        "Pedido recusado",
        `${creatorName} não vai conseguir atender este pedido${data.note ? `: "${data.note.trim().slice(0, 140)}"` : "."}`,
        "/requests",
        { request_id: req.id },
      );
    }
    return { ok: true as const, status: nextStatus };
  });

// ---------------------------------------------------------------- fã paga
export const createCustomRequestPixCharge = createServerFn({ method: "POST" })
  .middleware([requireAdultVerification])
  .validator((input: unknown) => z.object({ requestId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const fanId = context.userId;
    const req = await loadRequest(data.requestId);
    if (!req || req.fan_id !== fanId) return fail("Pedido não encontrado.");
    if (req.status !== "accepted") {
      return fail(req.status === "paid" || req.status === "delivered" ? "Este pedido já foi pago." : "Aguarde a criadora aceitar o pedido antes de pagar.");
    }
    try {
      await assertCreatorCanMonetize(req.creator_id, fanId);
    } catch (e) {
      return fail(e instanceof Error ? e.message : "A criadora não pode receber pagamentos agora.");
    }

    const externalId = `req_${fanId.slice(0, 8)}_${Date.now()}`;
    const gateway = await callImpulsePay(fanId, req.amount_cents, `Pedido personalizado ${fmtBRL(req.amount_cents)}`, externalId);
    if (!gateway.ok) return gateway;
    const px = gateway.pix;

    const { data: charge, error } = await supabaseAdmin
      .from("pix_charges")
      .insert({
        external_id: externalId,
        gateway_transaction_id: px.id,
        payer_id: fanId,
        payee_id: req.creator_id,
        purpose: "tip",
        amount_cents: req.amount_cents,
        status: "pending",
        qr_code: px.qrCode,
        qr_code_base64: null,
        expires_at: px.expiresAt,
        reference_id: req.id,
        metadata: { kind: "custom_request", request_id: req.id },
      })
      .select("id, qr_code, qr_code_base64, expires_at, external_id")
      .single();
    if (error || !charge) {
      console.error("[custom-requests.charge]", error?.code, error?.message);
      return fail("Falha ao registrar a cobrança. Tente novamente.");
    }
    await supabaseAdmin
      .from("custom_requests" as never)
      .update({ charge_id: charge.id, updated_at: new Date().toISOString() } as never)
      .eq("id", req.id);

    return {
      ok: true as const,
      chargeId: charge.id,
      externalId: charge.external_id,
      qrCode: charge.qr_code,
      qrCodeBase64: charge.qr_code_base64,
      expiresAt: charge.expires_at,
      amountCents: req.amount_cents,
    };
  });

// ---------------------------------------------------------------- entrega / cancelamento
export const markCustomRequestDelivered = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ requestId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const req = await loadRequest(data.requestId);
    if (!req || req.creator_id !== context.userId) return fail("Pedido não encontrado.");
    if (req.status !== "paid") return fail("Só pedidos pagos podem ser marcados como entregues.");
    const { error } = await supabaseAdmin
      .from("custom_requests" as never)
      .update({ status: "delivered", delivered_at: new Date().toISOString(), updated_at: new Date().toISOString() } as never)
      .eq("id", req.id)
      .eq("status", "paid");
    if (error) return fail("Não foi possível marcar como entregue.");
    const creatorName = await displayNameOf(req.creator_id);
    await notify(req.fan_id, "Seu pedido foi entregue 💝", `${creatorName} marcou seu pedido personalizado como entregue. Confira no chat.`, "/chat", {
      request_id: req.id,
    });
    return { ok: true as const };
  });

export const cancelCustomRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ requestId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const req = await loadRequest(data.requestId);
    if (!req || req.fan_id !== context.userId) return fail("Pedido não encontrado.");
    if (req.status !== "pending" && req.status !== "accepted") return fail("Este pedido não pode mais ser cancelado.");
    const { error } = await supabaseAdmin
      .from("custom_requests" as never)
      .update({ status: "cancelled", updated_at: new Date().toISOString() } as never)
      .eq("id", req.id)
      .in("status", ["pending", "accepted"]);
    if (error) return fail("Não foi possível cancelar o pedido.");
    return { ok: true as const };
  });

// ---------------------------------------------------------------- listagens
type ProfileMini = { user_id: string; username: string; display_name: string | null; avatar_url: string | null };

async function profilesFor(ids: string[]): Promise<Record<string, ProfileMini>> {
  if (ids.length === 0) return {};
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("user_id, username, display_name, avatar_url")
    .in("user_id", Array.from(new Set(ids)));
  return Object.fromEntries(((data ?? []) as ProfileMini[]).map((p) => [p.user_id, p]));
}

export const listMyCustomRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await supabaseAdmin
      .from("custom_requests" as never)
      .select("*")
      .eq("fan_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    const rows = (data ?? []) as unknown as RequestRow[];
    const profiles = await profilesFor(rows.map((r) => r.creator_id));
    return { requests: rows.map((r) => ({ ...r, counterpart: profiles[r.creator_id] ?? null })) };
  });

export const listCreatorCustomRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await supabaseAdmin
      .from("custom_requests" as never)
      .select("*")
      .eq("creator_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(200);
    const rows = (data ?? []) as unknown as RequestRow[];
    const profiles = await profilesFor(rows.map((r) => r.fan_id));
    return { requests: rows.map((r) => ({ ...r, counterpart: profiles[r.fan_id] ?? null })) };
  });
