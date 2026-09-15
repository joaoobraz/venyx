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
