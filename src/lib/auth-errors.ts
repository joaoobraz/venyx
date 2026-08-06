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

export function getPasswordLoginError(error: unknown, locale: "pt-BR" | "en" = "pt-BR") {
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
