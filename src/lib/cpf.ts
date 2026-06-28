/**
 * Validação de CPF (dígitos verificadores) e idade.
 * Usado na verificação de identidade do assinante (gate de +18 ao assinar).
 *
 * IMPORTANTE: validar o CPF matematicamente NÃO prova que ele pertence à pessoa.
 * Para confirmar que CPF + nome + nascimento batem com o documento oficial é
 * necessária uma API de consulta de CPF (Receita/KYC). Ver verification.functions.ts.
 */

export function onlyDigits(v: string): string {
  return (v ?? "").replace(/\D/g, "");
}

/** Formata 11 dígitos como 000.000.000-00 */
export function formatCpf(v: string): string {
  const d = onlyDigits(v).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

/** Valida os dígitos verificadores do CPF. */
export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11) return false;
  // rejeita sequências repetidas (000..., 111..., etc.)
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const calcDigit = (base: string, factorStart: number): number => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) {
      sum += parseInt(base[i], 10) * (factorStart - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  const d1 = calcDigit(cpf.slice(0, 9), 10);
  if (d1 !== parseInt(cpf[9], 10)) return false;
  const d2 = calcDigit(cpf.slice(0, 10), 11);
  if (d2 !== parseInt(cpf[10], 10)) return false;
  return true;
}

/** Idade (anos completos) a partir de uma data ISO 'YYYY-MM-DD'. Retorna null se inválida. */
export function ageFromBirthDate(birthDate: string, today = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((birthDate ?? "").trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const birth = new Date(Date.UTC(year, month - 1, day));
  if (
    birth.getUTCFullYear() !== year ||
    birth.getUTCMonth() !== month - 1 ||
    birth.getUTCDate() !== day
  ) {
    return null; // data inexistente (ex: 31/02)
  }
  if (birth.getTime() > today.getTime()) return null; // futuro

  let age = today.getUTCFullYear() - year;
  const mDiff = today.getUTCMonth() - (month - 1);
  if (mDiff < 0 || (mDiff === 0 && today.getUTCDate() < day)) age--;
  return age;
}

export function isAdult(birthDate: string, today = new Date()): boolean {
  const age = ageFromBirthDate(birthDate, today);
  return age !== null && age >= 18;
}
