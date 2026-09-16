import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Registra a referência de afiliado de forma segura no servidor:
 * valida que o código existe, descobre o ambassador real e impede
 * que o usuário falsifique o ambassador_id ou crie referências em
 * nome de terceiros.
 */
export const registerAffiliateReferralServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ code: z.string().min(1).max(64) }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const code = data.code.trim();

    const { data: aff } = await supabaseAdmin
      .from("affiliate_codes")
      .select("user_id")
      .eq("code", code)
      .maybeSingle();

    if (!aff) return { ok: false as const, reason: "invalid_code" };
    if (aff.user_id === userId) return { ok: false as const, reason: "self_referral" };

    // Verifica duplicata
    const { data: existing } = await supabaseAdmin
      .from("affiliate_referrals")
      .select("referred_user_id")
      .eq("referred_user_id", userId)
      .maybeSingle();
    if (existing) return { ok: true as const, duplicated: true };

    await supabaseAdmin.from("affiliate_referrals").insert({
      code,
      ambassador_id: aff.user_id,
      referred_user_id: userId,
    });

    return { ok: true as const };
  });
