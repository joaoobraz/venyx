// Espelha a política configurada no Supabase Auth (Sign In / Providers → Email):
// mínimo 8 caracteres com minúscula, maiúscula, número e símbolo. Validar aqui
// evita que o usuário só descubra a regra pelo erro genérico do servidor.

export const PASSWORD_MIN_LENGTH = 8;

type Tr = (pt: string, en: string) => string;

/** Lista as regras que a senha ainda não cumpre (vazia = senha válida). */
export function passwordProblems(password: string, tr: Tr): string[] {
  const problems: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) {
    problems.push(tr(`pelo menos ${PASSWORD_MIN_LENGTH} caracteres`, `at least ${PASSWORD_MIN_LENGTH} characters`));
  }
  if (!/[a-z]/.test(password)) problems.push(tr("uma letra minúscula", "a lowercase letter"));
  if (!/[A-Z]/.test(password)) problems.push(tr("uma letra maiúscula", "an uppercase letter"));
  if (!/\d/.test(password)) problems.push(tr("um número", "a number"));
  if (!/[^A-Za-z0-9]/.test(password)) problems.push(tr("um símbolo (ex.: ! @ # $ %)", "a symbol (e.g. ! @ # $ %)"));
  return problems;
}

/** Mensagem pronta para toast/inline, ou null se a senha é válida. */
export function passwordPolicyMessage(password: string, tr: Tr): string | null {
  const problems = passwordProblems(password, tr);
  if (problems.length === 0) return null;
  return tr("A senha precisa ter: ", "Your password needs: ") + problems.join(", ") + ".";
}

/** Texto de ajuda exibido abaixo do campo. */
export function passwordPolicyHint(tr: Tr): string {
  return tr(
    `Mínimo ${PASSWORD_MIN_LENGTH} caracteres, com letra maiúscula, minúscula, número e símbolo.`,
    `At least ${PASSWORD_MIN_LENGTH} characters, with uppercase, lowercase, a number and a symbol.`,
  );
}
