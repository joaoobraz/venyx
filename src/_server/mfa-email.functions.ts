import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sessionHasMfa, sessionProvedEmailOtp, type SessionClaims } from "@/_server/mfa.server";

/**
 * 2FA por e-mail. O código em si é enviado/validado pelo Supabase Auth
 * (signInWithOtp / verifyOtp no cliente); aqui o servidor confere, pelo JWT,
 * que a sessão realmente nasceu de um OTP recente e a registra como
 * verificada. Tudo condicionado ao flag platform_settings.email_mfa_enabled.
 */

const fail = (error: string) => ({ ok: false as const, error });

async function platformEmailMfaEnabled(): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("platform_settings")
    .select("email_mfa_enabled" as never)
    .eq("id", 1)
    .maybeSingle();
  return Boolean((data as unknown as { email_mfa_enabled?: boolean } | null)?.email_mfa_enabled);
}

async function securityOf(userId: string) {
  const { data } = await supabaseAdmin
    .from("security_settings")
    .select("mfa_enabled, mfa_method" as never)
    .eq("user_id", userId)
    .maybeSingle();
  const row = data as unknown as { mfa_enabled: boolean; mfa_method: "totp" | "email" } | null;
  return { mfaEnabled: Boolean(row?.mfa_enabled), method: (row?.mfa_method ?? "totp") as "totp" | "email" };
}

async function hasVerifiedTotp(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin.auth.admin.mfa.listFactors({ userId });
  return (data?.factors ?? []).some((f) => f.factor_type === "totp" && f.status === "verified");
}

export const getMyMfaState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const claims = context.claims as SessionClaims;
    const [platformEnabled, security, hasTotp, verified] = await Promise.all([
      platformEmailMfaEnabled(),
      securityOf(context.userId),
      hasVerifiedTotp(context.userId),
      sessionHasMfa(claims),
    ]);
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const email = userData?.user?.email ?? null;
    const emailPending =
      platformEnabled && security.mfaEnabled && security.method === "email" && !hasTotp && !verified;
    return {
      platformEmailMfaEnabled: platformEnabled,
      method: security.method,
      mfaEnabled: security.mfaEnabled || hasTotp,
      hasTotp,
      sessionVerified: verified,
      emailPending,
      email,
    };
  });

const confirmSchema = z.object({ enable: z.boolean().optional() });

export const confirmEmailMfaSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => confirmSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const claims = context.claims as SessionClaims;
    if (!claims.session_id) return fail("Sessão inválida. Entre novamente.");
    if (!sessionProvedEmailOtp(claims)) {
      return fail("Confirme primeiro o código que enviamos para o seu e-mail.");
    }
    if (!(await platformEmailMfaEnabled())) {
      return fail("O 2FA por e-mail não está disponível no momento.");
    }

    if (data.enable) {
      if (await hasVerifiedTotp(context.userId)) {
        return fail("Desative o aplicativo autenticador antes de trocar para o código por e-mail.");
      }
      const { error } = await supabaseAdmin.from("security_settings").upsert(
        {
          user_id: context.userId,
          mfa_enabled: true,
          mfa_method: "email",
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: "user_id" },
      );
      if (error) {
        console.error("[mfa-email.enable]", error.code, error.message);
        return fail("Não foi possível ativar o 2FA por e-mail.");
      }
    }

    const { error: sessionError } = await supabaseAdmin
      .from("email_mfa_sessions" as never)
      .upsert(
        { session_id: claims.session_id, user_id: context.userId, verified_at: new Date().toISOString() } as never,
        { onConflict: "session_id" },
      );
    if (sessionError) {
      console.error("[mfa-email.session]", sessionError.code, sessionError.message);
      return fail("Não foi possível registrar a verificação. Tente novamente.");
    }
    return { ok: true as const };
  });

export const disableEmailMfa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const claims = context.claims as SessionClaims;
    if (!(await sessionHasMfa(claims))) {
      return fail("Confirme o código de 2FA nesta sessão antes de desativar.");
    }
    const { error } = await supabaseAdmin.from("security_settings").upsert(
      { user_id: context.userId, mfa_enabled: false, mfa_method: "totp", updated_at: new Date().toISOString() } as never,
      { onConflict: "user_id" },
    );
    if (error) return fail("Não foi possível desativar o 2FA por e-mail.");
    await supabaseAdmin.from("email_mfa_sessions" as never).delete().eq("user_id", context.userId);
    return { ok: true as const };
  });
