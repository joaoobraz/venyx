type AuthErrorLike = {
  code?: string;
  message?: string;
};

const messages = {
  pt: {
    invalid: "E-mail ou senha inválidos.",
    unconfirmed: "Confirme seu e-mail antes de entrar na Fanlira.",
    unavailable: "Não foi possível entrar agora. Tente novamente.",
  },
  en: {
    invalid: "Invalid email or password.",
    unconfirmed: "Confirm your email before signing in to Fanlira.",
    unavailable: "Unable to sign in right now. Please try again.",
  },
} as const;

export function getPasswordLoginError(error: unknown, locale: "pt-BR" | "en" | "es" = "pt-BR") {
  const copy = locale === "en" ? messages.en : messages.pt;
  const authError = error as AuthErrorLike | null;
  const code = authError?.code?.toLowerCase();
  const message = authError?.message?.toLowerCase() ?? "";

  if (code === "invalid_credentials" || message.includes("invalid login credentials")) {
    return copy.invalid;
  }

  if (code === "email_not_confirmed" || message.includes("email not confirmed")) {
    return copy.unconfirmed;
  }

  return authError?.message || copy.unavailable;
}

/**
 * Erros de 2FA (app autenticador ou código por e-mail) em linguagem humana,
 * no idioma da conta. O Supabase devolve textos técnicos em inglês.
 */
export function describeMfaError(error: unknown, tr: (pt: string, en: string) => string): string {
  const authError = error as AuthErrorLike | null;
  const code = authError?.code?.toLowerCase() ?? "";
  const message = authError?.message?.toLowerCase() ?? "";
  if (
    code === "mfa_verification_failed" ||
    code === "otp_expired" ||
    /invalid totp|invalid.*code|token has expired|otp.*expired|invalid otp|invalid token/.test(message)
  ) {
    return tr(
      "Código inválido ou expirado. Confira os 6 dígitos e tente de novo.",
      "Invalid or expired code. Check the 6 digits and try again.",
    );
  }
  if (code === "over_request_rate_limit" || code === "over_email_send_rate_limit" || /rate limit|too many/.test(message)) {
    return tr("Muitas tentativas. Aguarde um minuto e tente novamente.", "Too many attempts. Wait a minute and try again.");
  }
  if (/network|fetch|failed to/.test(message)) {
    return tr("Sem conexão. Verifique sua internet e tente de novo.", "No connection. Check your internet and try again.");
  }
  return tr("Não foi possível confirmar o código. Tente novamente.", "Couldn't confirm the code. Try again.");
}

/**
 * Traduz o erro de senha fraca do Supabase (política do painel: 8+ caracteres
 * com maiúscula, minúscula, número e símbolo) para uma frase compreensível.
 * Devolve null se o erro não for sobre a senha.
 */
export function getWeakPasswordError(error: unknown, locale: "pt-BR" | "en" | "es" = "pt-BR") {
  const authError = error as AuthErrorLike | null;
  const code = authError?.code?.toLowerCase();
  const message = authError?.message?.toLowerCase() ?? "";
  const weak =
    code === "weak_password" ||
    message.includes("password should") ||
    message.includes("weak password") ||
    message.includes("password is too weak");
  if (!weak) return null;
  return locale === "en"
    ? "Weak password: use at least 8 characters with uppercase, lowercase, a number and a symbol."
    : "Senha fraca: use pelo menos 8 caracteres com letra maiúscula, minúscula, número e símbolo.";
}
