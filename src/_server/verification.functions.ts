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
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
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
  .inputValidator((input: unknown) => verifySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const cpf = onlyDigits(data.cpf);

    if (!isValidCpf(cpf)) {
      return { ok: false as const, error: "CPF inválido. Confira os números." };
    }
    if (!isAdult(data.birth_date)) {
      return { ok: false as const, error: "Você precisa ter 18 anos ou mais." };
    }
    const firstName = data.full_name.trim().split(/\s+/)[0] ?? "";
    if (firstName.length < 2) {
      return { ok: false as const, error: "Informe seu nome completo, como no documento." };
    }

    const match = await matchCpfWithDocument({
      cpf,
      fullName: data.full_name,
      birthDate: data.birth_date,
    });
    if (!match.checked) {
      return {
        ok: false as const,
        error:
          "A verificação oficial de identidade ainda não está configurada. Tente novamente mais tarde.",
      };
    }
    if (match.checked && !match.ok) {
      return {
        ok: false as const,
        error: "Os dados não correspondem ao documento. Confira CPF, nome e data de nascimento.",
      };
    }

    const { error } = await supabaseAdmin.from("identity_verifications").upsert(
      {
        user_id: userId,
        country: data.country,
        cpf,
        full_name: data.full_name.trim(),
        birth_date: data.birth_date,
        status: "verified",
        method: match.method,
        verified_at: new Date().toISOString(),
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

    return { ok: true as const };
  });

export const getMyVerificationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await supabaseAdmin
      .from("identity_verifications")
      .select("status")
      .eq("user_id", context.userId)
      .maybeSingle();
    return { verified: (data as { status?: string } | null)?.status === "verified" };
  });
