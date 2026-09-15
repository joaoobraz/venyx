import { supabase } from "@/integrations/supabase/client";

type MfaResult = { ok: true } | { ok: false; error: string };

/** Sessão está em aal1 mas a conta tem fator verificado (2FA pendente). */
export async function mfaStepUpPending(): Promise<boolean> {
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return data?.currentLevel === "aal1" && data?.nextLevel === "aal2";
}

/** Já está com 2FA confirmado nesta sessão? */
export async function hasAal2(): Promise<boolean> {
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return data?.currentLevel === "aal2";
}

/**
 * Verifica um código TOTP contra o fator ativo, SEMPRE (mesmo já em aal2).
 * Usado para reconfirmar ações sensíveis, como desativar o próprio 2FA.
 */
export async function verifyTotpCode(code: string): Promise<MfaResult> {
  const digits = code.replace(/\D/g, "");
  if (digits.length < 6) {
    return { ok: false, error: "Digite o código de 6 dígitos do seu aplicativo autenticador." };
  }

  const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
  if (factorsError) return { ok: false, error: "Não foi possível verificar o 2FA. Tente novamente." };
  const factor = factors?.totp?.find((item) => item.status === "verified");
  if (!factor) {
    return {
      ok: false,
      error: "Nenhum aplicativo autenticador está ativo nesta conta. Ative o 2FA em Configurações → Segurança.",
    };
  }

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId: factor.id,
  });
  if (challengeError || !challenge) {
    return { ok: false, error: "Não foi possível iniciar a verificação do 2FA. Tente novamente." };
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId: factor.id,
    challengeId: challenge.id,
    code: digits,
  });
  if (verifyError) {
    return { ok: false, error: "Código inválido ou expirado. Confira o app autenticador e tente de novo." };
  }

  return { ok: true };
}

/**
 * Eleva a sessão atual para aal2 verificando o código do autenticador, sem
 * exigir logout. Ativar 2FA não eleva a sessão que já estava aberta; ações
 * financeiras (chave Pix, saque) pedem aal2 — este passo resolve na hora.
 */
export async function elevateToAal2(code: string): Promise<MfaResult> {
  if (await hasAal2()) return { ok: true };
  return verifyTotpCode(code);
}
