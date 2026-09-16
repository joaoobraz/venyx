import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type SessionClaims = {
  sub?: string;
  aal?: string;
  session_id?: string;
  amr?: Array<{ method?: string; timestamp?: number }>;
};

/**
 * A sessão satisfez o segundo fator? Ou é aal2 (app autenticador, nativo do
 * Supabase) ou foi confirmada por código de e-mail e registrada em
 * email_mfa_sessions pelo servidor.
 */
export async function sessionHasMfa(claims: SessionClaims): Promise<boolean> {
  if (claims.aal === "aal2") return true;
  if (!claims.session_id || !claims.sub) return false;
  // A sessão por e-mail só conta se o método da conta for e-mail (coluna
  // server-only), a conta não tiver app autenticador e não for admin —
  // admin exige aal2 de verdade. Sem isto, quem só controlasse a caixa de
  // e-mail viraria "2FA satisfeito" em qualquer conta.
  const [{ data: security }, { data: factors }, { data: adminRole }] = await Promise.all([
    supabaseAdmin.from("security_settings").select("mfa_method" as never).eq("user_id", claims.sub).maybeSingle(),
    supabaseAdmin.auth.admin.mfa.listFactors({ userId: claims.sub }),
    supabaseAdmin.from("user_roles").select("role").eq("user_id", claims.sub).eq("role", "admin").maybeSingle(),
  ]);
  if ((security as unknown as { mfa_method?: string } | null)?.mfa_method !== "email") return false;
  if ((factors?.factors ?? []).some((f) => f.factor_type === "totp" && f.status === "verified")) return false;
  if (adminRole) return false;
  const { data } = await supabaseAdmin
    .from("email_mfa_sessions" as never)
    .select("session_id")
    .eq("session_id", claims.session_id)
    .eq("user_id", claims.sub)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return !!data;
}

/** A sessão atual nasceu de um código OTP por e-mail há pouco (≤ 15 min)? */
export function sessionProvedEmailOtp(claims: SessionClaims): boolean {
  const amr = Array.isArray(claims.amr) ? claims.amr : [];
  const now = Math.floor(Date.now() / 1000);
  return amr.some(
    (entry) =>
      (entry.method === "otp" || entry.method === "magiclink") &&
      typeof entry.timestamp === "number" &&
      now - entry.timestamp <= 15 * 60,
  );
}
