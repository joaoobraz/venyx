import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseMfa } from "@/_server/access-control.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { onlyDigits } from "@/lib/cpf";
import {
  createImpulsePayWithdrawal,
  getImpulsePayBalance,
  ImpulsePayConfigurationError,
  ImpulsePayRequestError,
  impulsePayIsConfigured,
  toImpulsePayPixKeyType,
} from "@/_server/impulsepay.server";

function safeError(internal: unknown, msg = "Operação falhou. Tente novamente."): Error {
  console.error("[withdrawals]", internal);
  return new Error(msg);
}

function fmtBRL(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

async function notify(
  userId: string,
  title: string,
  body: string,
  metadata: { [key: string]: Json | undefined } = {},
) {
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
  .middleware([requireSupabaseMfa])
  .validator((input: unknown) => upsertKeySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // Confirma que é criadora
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isCreator = (roles ?? []).some((r) => r.role === "creator");
    if (!isCreator) throw new Error("Apenas criadoras podem cadastrar chave PIX");

    const { data: identity, error: identityError } = await supabaseAdmin
      .from("identity_verifications")
      .select("cpf, full_name, status")
      .eq("user_id", userId)
      .eq("status", "verified")
      .maybeSingle();
    if (identityError || !identity) {
      throw new Error("Confirme sua identidade e seu CPF antes de cadastrar a chave Pix");
    }

    const verifiedCpf = onlyDigits(identity.cpf);
    const informedDocument = onlyDigits(data.holder_document);
    if (informedDocument !== verifiedCpf) {
      throw new Error("O CPF do titular deve ser o mesmo CPF verificado na sua conta");
    }
    if (data.pix_key_type === "cpf" && onlyDigits(data.pix_key) !== verifiedCpf) {
      throw new Error("A chave Pix do tipo CPF deve ser o CPF verificado na sua conta");
    }

    const { data: payoutKey, error } = await supabaseAdmin
      .from("creator_payout_keys")
      .upsert(
        {
          user_id: userId,
          pix_key: data.pix_key.trim(),
          pix_key_type: data.pix_key_type,
          holder_name: identity.full_name.trim(),
          holder_document: verifiedCpf,
        },
        { onConflict: "user_id" },
      )
      .select("withdrawal_eligible_at")
      .single();
    if (error || !payoutKey) throw safeError(error);
    return { ok: true, withdrawal_eligible_at: payoutKey.withdrawal_eligible_at };
  });

// ===================== Pedido de saque (criadora) =====================
const requestSchema = z.object({
  amount_cents: z.number().int().min(3000).max(100_000_000),
});

export const requestWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseMfa])
  .validator((input: unknown) => requestSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // A função de banco obtém um lock por criadora, recalcula o saldo e cria o
    // pedido na mesma transação. Isso impede dois saques simultâneos do mesmo saldo.
    const { data: withdrawalId, error } = await supabaseAdmin.rpc("create_withdrawal_request", {
      _creator_id: userId,
      _amount_cents: data.amount_cents,
    });
    if (error || !withdrawalId) {
      const message = error?.message ?? "";
      if (message.includes("FANLIRA_DAILY_WITHDRAWAL_LIMIT")) {
        throw new Error("Limite diário de 5 saques atingido. Tente novamente amanhã");
      }
      if (message.includes("VENYX_KYC_REQUIRED")) {
        throw new Error("Você precisa concluir o KYC antes de sacar");
      }
      if (message.includes("VENYX_PIX_KEY_REQUIRED")) {
        throw new Error("Cadastre sua chave PIX antes de solicitar saque");
      }
      if (message.includes("VENYX_PIX_KEY_COOLDOWN")) {
        throw new Error("A chave Pix foi alterada. Por segurança, aguarde 48 horas para sacar");
      }
      if (message.includes("VENYX_PIX_IDENTITY_MISMATCH")) {
        throw new Error("A chave Pix precisa pertencer ao CPF verificado na sua conta");
      }
      if (message.includes("VENYX_INSUFFICIENT_BALANCE")) {
        throw new Error("Saldo insuficiente para este saque");
      }
      if (message.includes("VENYX_MIN_WITHDRAWAL")) {
        throw new Error("O valor está abaixo do saque mínimo");
      }
      throw safeError(error);
    }

    const { data: withdrawal, error: withdrawalError } = await supabaseAdmin
      .from("withdrawal_requests")
      .select("fanlira_withdrawal_fee_cents")
      .eq("id", withdrawalId)
      .eq("creator_id", userId)
      .single();
    if (withdrawalError || !withdrawal) throw safeError(withdrawalError);

    await notify(
      userId,
      "Saque solicitado",
      `Seu pedido de ${fmtBRL(data.amount_cents)} foi enviado. Taxa Fanlira: ${fmtBRL(withdrawal.fanlira_withdrawal_fee_cents)}.`,
      {
        withdrawal_id: withdrawalId,
        amount_cents: data.amount_cents,
        fanlira_withdrawal_fee_cents: withdrawal.fanlira_withdrawal_fee_cents,
      },
    );

    return {
      ok: true,
      withdrawal_id: withdrawalId,
      fanlira_withdrawal_fee_cents: withdrawal.fanlira_withdrawal_fee_cents,
    };
  });

// ===================== Cancelar (criadora) =====================
const cancelSchema = z.object({ withdrawal_id: z.string().uuid() });

export const cancelWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseMfa])
  .validator((input: unknown) => cancelSchema.parse(input))
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

    const { data: canceled, error } = await supabaseAdmin
      .from("withdrawal_requests")
      .update({ status: "canceled" })
      .eq("id", data.withdrawal_id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (error) throw safeError(error);
    if (!canceled) throw new Error("Este saque já foi processado");
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

export const getImpulsePayOperationalBalance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseMfa])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    if (!impulsePayIsConfigured()) {
      return { configured: false as const, available: 0, reserved: 0 };
    }

    const balance = await getImpulsePayBalance();
    return {
      configured: true as const,
      available: balance.available,
      reserved: balance.reserved,
    };
  });

const adminIdSchema = z.object({
  withdrawal_id: z.string().uuid(),
  notes: z.string().max(500).optional().nullable(),
});

export const approveWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseMfa])
  .validator((input: unknown) => adminIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const { data: w } = await supabaseAdmin
      .from("withdrawal_requests")
      .select(
        "creator_id,amount_cents,fanlira_withdrawal_fee_cents,status,pix_key,pix_key_type,holder_document",
      )
      .eq("id", data.withdrawal_id)
      .maybeSingle();

    if (!w || w.status !== "pending") {
      throw new Error("Saque não encontrado ou já processado");
    }

    const { data: claimed, error } = await supabaseAdmin
      .from("withdrawal_requests")
      .update({
        status: "approved",
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
        admin_notes: data.notes ?? null,
      })
      .eq("id", data.withdrawal_id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (error) throw safeError(error);
    if (!claimed) throw new Error("Este saque já foi processado");

    let submittedNetAmount: number;
    let absorbedProviderFee: number;
    try {
      const transfer = await createImpulsePayWithdrawal({
        amountCents: w.amount_cents,
        pixKey: w.pix_key,
        pixKeyType: toImpulsePayPixKeyType(w.pix_key_type),
        document: w.holder_document,
      });
      if (
        !transfer?.id ||
        transfer.amount !== w.amount_cents ||
        !Number.isInteger(transfer.net_amount) ||
        transfer.net_amount < 0 ||
        transfer.net_amount > transfer.amount ||
        !Number.isInteger(transfer.fee) ||
        transfer.fee < 0
      ) {
        throw new Error("A Impulse Pay retornou um saque inválido");
      }
      submittedNetAmount = transfer.net_amount;
      absorbedProviderFee = transfer.amount - transfer.net_amount;

      const internalStatus = transfer.status === "PROCESSING" ? "processing" : "approved";
      const { error: gatewayUpdateError } = await supabaseAdmin
        .from("withdrawal_requests")
        .update({
          status: internalStatus,
          gateway_transfer_id: transfer.id,
          gateway_status: transfer.status,
          gateway_fee_cents: transfer.fee,
          gateway_net_amount_cents: transfer.net_amount,
        })
        .eq("id", data.withdrawal_id)
        .eq("status", "approved");
      if (gatewayUpdateError) {
        console.error("[withdrawals] transfer created but persistence failed", transfer.id);
        throw new Error(
          "O saque foi enviado à Impulse Pay, mas precisa de conciliação administrativa.",
        );
      }
    } catch (providerError) {
      const definitelyNotSubmitted =
        providerError instanceof ImpulsePayConfigurationError ||
        (providerError instanceof ImpulsePayRequestError &&
          providerError.status >= 400 &&
          providerError.status < 500 &&
          providerError.status !== 429);
      if (definitelyNotSubmitted) {
        await supabaseAdmin
          .from("withdrawal_requests")
          .update({ status: "pending", gateway_status: null })
          .eq("id", data.withdrawal_id)
          .eq("status", "approved")
          .is("gateway_transfer_id", null);
      } else {
        await supabaseAdmin
          .from("withdrawal_requests")
          .update({ gateway_status: "SUBMISSION_UNKNOWN" })
          .eq("id", data.withdrawal_id)
          .eq("status", "approved")
          .is("gateway_transfer_id", null);
      }
      if (providerError instanceof ImpulsePayConfigurationError) {
        throw new Error("Configure as credenciais de saque da Impulse Pay antes de aprovar.", {
          cause: providerError,
        });
      }
      if (!definitelyNotSubmitted) {
        throw new Error(
          "Não foi possível confirmar o envio. Confira o painel da Impulse Pay antes de tentar novamente.",
          { cause: providerError },
        );
      }
      throw new Error(
        providerError instanceof Error ? providerError.message : "A Impulse Pay recusou o saque.",
        { cause: providerError },
      );
    }

    await notify(
      w.creator_id,
      "Saque enviado",
      `A Impulse Pay está processando ${fmtBRL(submittedNetAmount)}. A Fanlira absorveu ${fmtBRL(absorbedProviderFee)} da adquirente; taxa deste saque: ${fmtBRL(w.fanlira_withdrawal_fee_cents)}.`,
      {
        withdrawal_id: data.withdrawal_id,
        requested_amount_cents: w.amount_cents,
        gateway_net_amount_cents: submittedNetAmount,
        gateway_fee_absorbed_cents: absorbedProviderFee,
        fanlira_withdrawal_fee_cents: w.fanlira_withdrawal_fee_cents,
      },
    );
    return { ok: true };
  });

// ===================== Admin: rejeitar =====================
const rejectSchema = z.object({
  withdrawal_id: z.string().uuid(),
  reason: z.string().min(3).max(500),
});

export const rejectWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseMfa])
  .validator((input: unknown) => rejectSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const { data: w } = await supabaseAdmin
      .from("withdrawal_requests")
      .select("creator_id,amount_cents,status,gateway_transfer_id")
      .eq("id", data.withdrawal_id)
      .maybeSingle();

    if (!w || !["pending", "approved"].includes(w.status)) {
      throw new Error("Saque não encontrado ou já finalizado");
    }
    if (w.gateway_transfer_id) {
      throw new Error("Este saque já foi enviado à Impulse Pay e não pode ser rejeitado aqui");
    }

    const { data: rejected, error } = await supabaseAdmin
      .from("withdrawal_requests")
      .update({
        status: "rejected",
        rejection_reason: data.reason,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.withdrawal_id)
      .in("status", ["pending", "approved"])
      .select("id")
      .maybeSingle();
    if (error) throw safeError(error);
    if (!rejected) throw new Error("Este saque já foi processado");

    await notify(
      w.creator_id,
      "Saque rejeitado",
      `Seu saque de ${fmtBRL(w.amount_cents)} foi rejeitado: ${data.reason}`,
      { withdrawal_id: data.withdrawal_id, reason: data.reason },
    );
    return { ok: true };
  });
