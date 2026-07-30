import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { onlyDigits, isValidCpf, isAdult } from "@/lib/cpf";

/**
 * Verificação de identidade/idade do assinante.
 *
 * Camada 1 (sempre): CPF matematicamente válido + idade >= 18.
 * Camada 2 (opcional, quando houver provedor): conferir se CPF + nome + nascimento
 * batem com o documento oficial via API de consulta de CPF. Ver matchCpfWithDocument().
 */

const verifySchema = z.object({
  country: z.string().min(2).max(4).default("BR"),
  cpf: z.string().min(11).max(20),
  full_name: z.string().trim().min(3).max(140),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
});

/**
 * Ponto de extensão para conferência com o documento oficial.
 * Hoje: se não houver provedor configurado (CPF_LOOKUP_API_KEY), pula essa camada.
 * Futuro: integrar Serpro / idwall / BigDataCorp / etc.
 */
async function matchCpfWithDocument(_input: {
  cpf: string;
  fullName: string;
  birthDate: string;
}): Promise<{ checked: boolean; ok: boolean }> {
  const apiKey = process.env.CPF_LOOKUP_API_KEY;
  if (!apiKey) return { checked: false, ok: true };
  // TODO[provedor]: chamar a API de consulta de CPF, comparar primeiro nome e
  // data de nascimento com o retorno oficial e devolver { checked: true, ok: matched }.
  return { checked: false, ok: true };
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
    if (match.checked && !match.ok) {
      return {
        ok: false as const,
        error: "Os dados não correspondem ao documento. Confira CPF, nome e data de nascimento.",
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela nova ainda fora dos tipos gerados do Supabase
    const { error } = await (supabaseAdmin.from("identity_verifications" as never) as any).upsert(
      {
        user_id: userId,
        country: data.country,
        cpf,
        full_name: data.full_name.trim(),
        birth_date: data.birth_date,
        status: "verified",
        method: match.checked ? "cpf_lookup" : "cpf_checksum",
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela nova ainda fora dos tipos gerados do Supabase
    const { data } = await (supabaseAdmin.from("identity_verifications" as never) as any)
      .select("status")
      .eq("user_id", context.userId)
      .maybeSingle();
    return { verified: (data as { status?: string } | null)?.status === "verified" };
  });
