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
