import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { onlyDigits, isValidCpf, isAdult } from "@/lib/cpf";

/**
 * Verificação de identidade/idade do assinante.
 *
 * CPF matematicamente válido é apenas uma validação de formato. Em produção, a
 * conta só é aprovada depois que um provedor confiável confirma CPF, nome e data
 * de nascimento.
 */

const verifySchema = z.object({
  country: z.string().min(2).max(4).default("BR"),
  cpf: z.string().min(11).max(20),
  full_name: z.string().trim().min(3).max(140),
  phone: z
    .string()
    .transform(onlyDigits)
    .refine((value) => /^\d{10,11}$/.test(value), {
      message: "Informe um telefone válido com DDD",
    }),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  document_type: z.enum(["RG", "CNH", "Passport"]),
  document_front_path: z.string().min(1).max(500),
  document_back_path: z.string().min(1).max(500).nullable().optional(),
  selfie_path: z.string().min(1).max(500),
});

/**
 * Ponto de extensão para conferência com documento oficial.
 * A exceção de checksum existe apenas para localhost e nunca funciona em produção.
 */
async function matchCpfWithDocument(_input: {
  cpf: string;
  fullName: string;
  birthDate: string;
}): Promise<{ checked: boolean; ok: boolean; method: string }> {
  const allowLocalChecksum =
    process.env.NODE_ENV !== "production" && process.env.ALLOW_INSECURE_AGE_CHECK === "true";

  if (allowLocalChecksum) {
    return { checked: true, ok: true, method: "local_cpf_checksum" };
  }

  const apiKey = process.env.CPF_LOOKUP_API_KEY;
  if (apiKey) {
    console.error(
      "[verifyIdentity] CPF_LOOKUP_API_KEY foi configurada, mas o adaptador do provedor ainda não foi implementado.",
    );
  }

  return { checked: false, ok: false, method: "provider_unavailable" };
}

export const verifyIdentity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => verifySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const cpf = onlyDigits(data.cpf);

    if (!isValidCpf(cpf)) {
      return { ok: false as const, error: "CPF inválido. Confira os números." };
    }
    if (!isAdult(data.birth_date)) {
      return { ok: false as const, error: "Você precisa ter 18 anos ou mais." };
    }
    const nameParts = data.full_name.trim().split(/\s+/).filter(Boolean);
    if (nameParts.length < 2 || nameParts.some((part) => part.length < 2)) {
      return { ok: false as const, error: "Informe seu nome completo, como no documento." };
    }

    const userPrefix = `${userId}/`;
    const submittedPaths = [
      data.document_front_path,
      data.document_back_path,
      data.selfie_path,
    ].filter((path): path is string => Boolean(path));
    if (
      submittedPaths.some(
        (path) =>
          !path.startsWith(userPrefix) ||
          path.includes("..") ||
          !/\.(jpe?g|png|webp|heic)$/i.test(path),
      )
    ) {
      return { ok: false as const, error: "Arquivos de verificação inválidos." };
    }

    const { data: current } = await supabaseAdmin
      .from("identity_verifications")
      .select("status")
      .eq("user_id", userId)
      .maybeSingle();
    if (current?.status === "verified") {
      return { ok: true as const, status: "verified" as const };
    }

    const match = await matchCpfWithDocument({
      cpf,
      fullName: data.full_name,
      birthDate: data.birth_date,
    });
    if (match.checked && !match.ok) {
      return {
        ok: false as const,
        error: "Os dados não correspondem ao documento. Confira CPF, nome e data de nascimento.",
      };
    }

    const verified = match.checked && match.ok;
    const { error } = await supabaseAdmin.from("identity_verifications").upsert(
      {
        user_id: userId,
        country: data.country,
        cpf,
        full_name: data.full_name.trim(),
        phone: data.phone,
        birth_date: data.birth_date,
        status: verified ? "verified" : "pending",
        method: verified ? match.method : "manual_document_review",
        document_type: data.document_type,
        document_front_url: data.document_front_path,
        document_back_url: data.document_back_path ?? null,
        selfie_url: data.selfie_path,
        rejection_reason: null,
        reviewed_by: null,
        reviewed_at: null,
        verified_at: verified ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (error) {
      if (error.code === "23505") {
        return { ok: false as const, error: "Este CPF já está vinculado a outra conta." };
      }
      console.error("[verifyIdentity]", error);
      return {
        ok: false as const,
        error: "Não foi possível concluir a verificação. Tente novamente.",
      };
    }

    return {
      ok: true as const,
      status: verified ? ("verified" as const) : ("pending" as const),
    };
  });

export const getMyVerificationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await supabaseAdmin
      .from("identity_verifications")
      .select("status, phone, rejection_reason")
      .eq("user_id", context.userId)
      .maybeSingle();
    const result = data as {
      status?: string;
      phone?: string | null;
      rejection_reason?: string | null;
    } | null;
    return {
      verified: result?.status === "verified" && /^\d{10,11}$/.test(onlyDigits(result.phone ?? "")),
      status: result?.status ?? "unsubmitted",
      rejectionReason: result?.rejection_reason ?? null,
    };
  });
