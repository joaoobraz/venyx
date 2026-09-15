/**
 * Erros vindos do Supabase/PostgREST são objetos simples, não instâncias de
 * Error — por isso o padrão `e instanceof Error ? e.message : "Erro"` escondia
 * a causa real e mostrava só "Erro" para quem estava usando o site.
 */

type Translate = (pt: string, en: string) => string;

type SupabaseLikeError = {
  message?: unknown;
  code?: unknown;
  details?: unknown;
  hint?: unknown;
};

/** Regras do banco que têm explicação e ação clara para a pessoa. */
const DOMAIN_RULES: Array<{ match: RegExp; pt: string; en: string }> = [
  {
    match: /VENYX_KYC_REQUIRED/,
    pt: "Conteúdo pago só libera depois que sua verificação de criadora for aprovada.",
    en: "Paid content is only available after your creator verification is approved.",
  },
  {
    match: /VENYX_CREATOR_CONSENT_REQUIRED/,
    pt: "Falta aceitar os termos de criadora. Refaça o cadastro de criadora para registrar o aceite.",
    en: "You still need to accept the creator terms. Redo the creator signup to record it.",
  },
  {
    match: /VENYX_CREATOR_PROFILE_REQUIRED/,
    pt: "Complete o perfil antes de publicar conteúdo pago: foto de perfil, nome de exibição e bio com pelo menos 20 caracteres.",
    en: "Complete your profile before posting paid content: profile photo, display name and a bio with at least 20 characters.",
  },
  {
    match: /VENYX_PIX_KEY_REQUIRED/,
    pt: "Cadastre sua chave Pix de saque (na Carteira) antes de publicar conteúdo pago.",
    en: "Register your Pix payout key (in the Wallet) before posting paid content.",
  },
  {
    match: /VENYX_KYC_ALREADY_ACTIVE/,
    pt: "Já existe uma verificação ativa para esta conta.",
    en: "There is already an active verification for this account.",
  },
  {
    match: /USERNAME_CHANGE_COOLDOWN/,
    pt: "O nome de usuário só pode ser trocado a cada 14 dias.",
    en: "The username can only be changed every 14 days.",
  },
  {
    match: /USERNAME_INVALID/,
    pt: "Nome de usuário inválido: use de 3 a 30 letras, números, ponto ou sublinhado.",
    en: "Invalid username: use 3 to 30 letters, numbers, dots or underscores.",
  },
  {
    match: /FANLIRA_MEDIA_PATH_FORBIDDEN|FANLIRA_MEDIA_PATH_POST_NOT_FOUND/,
    pt: "O arquivo enviado não pertence a esta conta. Envie a mídia novamente.",
    en: "The uploaded file doesn't belong to this account. Please upload it again.",
  },
  {
    match: /FANLIRA_RATE_LIMIT/,
    pt: "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.",
    en: "Too many attempts. Wait a few minutes and try again.",
  },
];

function asRecord(error: unknown): SupabaseLikeError | null {
  return error && typeof error === "object" ? (error as SupabaseLikeError) : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Mensagem explicando o motivo real da falha, pronta para mostrar num toast. */
export function describeError(error: unknown, tr: Translate): string {
  const record = asRecord(error);
  const message = error instanceof Error ? error.message : text(record?.message);
  const code = text(record?.code);
  const details = text(record?.details);
  const hint = text(record?.hint);
  const haystack = `${code} ${message} ${details} ${hint}`;

  const rule = DOMAIN_RULES.find((candidate) => candidate.match.test(haystack));
  if (rule) return tr(rule.pt, rule.en);

  if (code === "42501" || /permission denied/i.test(message)) {
    return tr(
      "Sua conta não tem permissão para esta ação. Se você acha que deveria ter, fale com o suporte.",
      "Your account isn't allowed to do this. If you think it should be, contact support.",
    );
  }
  if (code === "23505") {
    return tr("Esse valor já está cadastrado e não pode repetir.", "This value already exists and can't be duplicated.");
  }
  if (code === "23502") {
    return tr(
      "Falta preencher um campo obrigatório.",
      "A required field is missing.",
    );
  }
  if (code === "23514" || code === "22023" || code === "22P02") {
    return tr(
      "Algum valor informado não é aceito. Revise os campos e tente de novo.",
      "One of the values isn't accepted. Review the fields and try again.",
    );
  }
  if (code === "23503") {
    return tr(
      "Um dado relacionado não existe mais. Recarregue a página e tente de novo.",
      "A related record no longer exists. Reload the page and try again.",
    );
  }
  if (code === "57014" || /timeout|timed out/i.test(message)) {
    return tr(
      "A operação demorou demais e foi interrompida. Tente de novo em instantes.",
      "The operation took too long and was cancelled. Try again shortly.",
    );
  }
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return tr(
      "Sem conexão com o servidor. Verifique sua internet e tente de novo.",
      "No connection to the server. Check your internet and try again.",
    );
  }

  // Erros internos (coluna/tabela/função inexistente, sintaxe): a pessoa não
  // tem o que corrigir, então a mensagem orienta o contato com o suporte e
  // mantém o detalhe técnico entre parênteses para o diagnóstico.
  if (["42703", "42P01", "42883", "42601", "42804", "P0001"].includes(code)) {
    const technical = message || code;
    return tr(
      `Erro interno do sistema. Avise o suporte informando: "${technical}".`,
      `Internal system error. Contact support with: "${technical}".`,
    );
  }

  if (message) {
    return tr(
      `Não foi possível concluir: ${message}`,
      `Couldn't complete: ${message}`,
    );
  }
  return tr("Não foi possível concluir. Tente novamente.", "Couldn't complete. Please try again.");
}
