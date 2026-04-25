import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function safeError(internal: unknown, msg = "Operação falhou. Tente novamente."): Error {
  console.error("[withdrawals]", internal);
  return new Error(msg);
}

function fmtBRL(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

async function notify(userId: string, title: string, body: string, metadata: Record<string, unknown> = {}) {
  try {
    await supabaseAdmin.from("notifications").insert({
      user_id: userId,
      type: "withdrawal",
      title,
      body,
      link: "/creator/wallet",
      metadata,
    });
  } catch (e) {
    console.error("[withdrawals.notify]", e);
  }
}

// ===================== Chave PIX da criadora =====================
const upsertKeySchema = z.object({
  pix_key: z.string().min(3).max(140),
  pix_key_type: z.enum(["cpf", "cnpj", "email", "phone", "random"]),
  holder_name: z.string().min(2).max(140),
  holder_document: z.string().min(11).max(20),
});

export const upsertPayoutKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => upsertKeySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // Confirma que é criadora
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isCreator = (roles ?? []).some((r) => r.role === "creator");
    if (!isCreator) throw new Error("Apenas criadoras podem cadastrar chave PIX");

    const { error } = await supabaseAdmin
      .from("creator_payout_keys")
      .upsert(
        {
          user_id: userId,
          pix_key: data.pix_key.trim(),
          pix_key_type: data.pix_key_type,
          holder_name: data.holder_name.trim(),
          holder_document: data.holder_document.replace(/\D/g, ""),
        },
        { onConflict: "user_id" },
      );
    if (error) throw safeError(error);
    return { ok: true };
  });

// ===================== Pedido de saque (criadora) =====================
const requestSchema = z.object({
  amount_cents: z.number().int().min(3000).max(100_000_000),
});

export const requestWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => requestSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // 1) KYC aprovado?
    const { data: kyc } = await supabaseAdmin
      .from("kyc_requests")
      .select("status")
      .eq("user_id", userId)
      .eq("status", "approved")
      .maybeSingle();
    if (!kyc) throw new Error("Você precisa concluir o KYC antes de sacar");

    // 2) Chave PIX cadastrada?
    const { data: key } = await supabaseAdmin
      .from("creator_payout_keys")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (!key) throw new Error("Cadastre sua chave PIX antes de solicitar saque");

    // 3) Settings + saldo
    const { data: settings } = await supabaseAdmin
      .from("platform_settings")
      .select("min_withdrawal_cents")
      .eq("id", 1)
      .single();
    if (!settings) throw new Error("Configurações indisponíveis");
    if (data.amount_cents < settings.min_withdrawal_cents) {
      throw new Error(`Saque mínimo é R$ ${(settings.min_withdrawal_cents / 100).toFixed(2)}`);
    }

    const { data: bal } = await supabaseAdmin
      .from("creator_balances")
      .select("available_cents")
      .eq("creator_id", userId)
      .maybeSingle();
    const available = bal?.available_cents ?? 0;
    if (data.amount_cents > available) {
      throw new Error(
        `Saldo insuficiente. Disponível: R$ ${(available / 100).toFixed(2)}`,
      );
    }

    // 4) Cria pedido
    const { data: req, error } = await supabaseAdmin
      .from("withdrawal_requests")
      .insert({
        creator_id: userId,
        amount_cents: data.amount_cents,
        pix_key: key.pix_key,
        pix_key_type: key.pix_key_type,
        holder_name: key.holder_name,
        holder_document: key.holder_document,
        status: "pending",
      })
      .select("id")
      .single();
    if (error) throw safeError(error);

    return { ok: true, withdrawal_id: req.id };
  });

// ===================== Cancelar (criadora) =====================
const cancelSchema = z.object({ withdrawal_id: z.string().uuid() });

export const cancelWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => cancelSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: w } = await supabaseAdmin
      .from("withdrawal_requests")
      .select("creator_id, status")
      .eq("id", data.withdrawal_id)
      .maybeSingle();
    if (!w) throw new Error("Saque não encontrado");
    if (w.creator_id !== userId) throw new Error("Sem permissão");
    if (w.status !== "pending") throw new Error("Só é possível cancelar saques pendentes");

    const { error } = await supabaseAdmin
      .from("withdrawal_requests")
      .update({ status: "canceled" })
      .eq("id", data.withdrawal_id);
    if (error) throw safeError(error);
    return { ok: true };
  });

// ===================== Admin: aprovar =====================
async function assertAdmin(userId: string) {
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (!(roles ?? []).some((r) => r.role === "admin")) {
    throw new Error("Apenas administradores");
  }
}

const adminIdSchema = z.object({
  withdrawal_id: z.string().uuid(),
  notes: z.string().max(500).optional().nullable(),
});

export const approveWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => adminIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("withdrawal_requests")
      .update({
        status: "approved",
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
        admin_notes: data.notes ?? null,
      })
      .eq("id", data.withdrawal_id)
      .eq("status", "pending");
    if (error) throw safeError(error);
    return { ok: true };
  });

// ===================== Admin: marcar como pago =====================
const markPaidSchema = z.object({
  withdrawal_id: z.string().uuid(),
  receipt_url: z.string().url().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export const markWithdrawalPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => markPaidSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const { data: w } = await supabaseAdmin
      .from("withdrawal_requests")
      .select("creator_id, amount_cents, status")
      .eq("id", data.withdrawal_id)
      .maybeSingle();
    if (!w) throw new Error("Saque não encontrado");
    if (!["approved", "processing", "pending"].includes(w.status)) {
      throw new Error(`Saque está em estado ${w.status} e não pode ser marcado como pago`);
    }

    // Registra a transação de saída (espelha no histórico)
    const { error: txErr } = await supabaseAdmin.from("transactions").insert({
      payer_id: null,
      payee_id: w.creator_id,
      type: "withdrawal",
      status: "paid",
      amount_cents: w.amount_cents,
      reference_id: data.withdrawal_id,
      gateway: "manual",
      gateway_ref: data.receipt_url ?? null,
      metadata: { withdrawal_id: data.withdrawal_id, notes: data.notes ?? null },
    });
    if (txErr) throw safeError(txErr);

    const { error } = await supabaseAdmin
      .from("withdrawal_requests")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        receipt_url: data.receipt_url ?? null,
        admin_notes: data.notes ?? null,
        reviewed_by: context.userId,
      })
      .eq("id", data.withdrawal_id);
    if (error) throw safeError(error);
    return { ok: true };
  });

// ===================== Admin: rejeitar =====================
const rejectSchema = z.object({
  withdrawal_id: z.string().uuid(),
  reason: z.string().min(3).max(500),
});

export const rejectWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => rejectSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("withdrawal_requests")
      .update({
        status: "rejected",
        rejection_reason: data.reason,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.withdrawal_id)
      .in("status", ["pending", "approved"]);
    if (error) throw safeError(error);
    return { ok: true };
  });
