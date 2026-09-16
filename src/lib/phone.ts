/** DDDs realmente atribuídos pela Anatel (evita números como 00 ou 20). */
const VALID_DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19,
  21, 22, 24,
  27, 28,
  31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55,
  61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79,
  81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

export function onlyPhoneDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 11);
}

/** Formata progressivamente como (11) 99999-9999 (ou (11) 9999-9999 pra fixo) enquanto digita. */
export function formatPhone(value: string): string {
  const digits = onlyPhoneDigits(value);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (rest.length === 0) return `(${ddd}) `;
  const isCellphone = rest.length > 4 && (rest.length === 9 || rest[0] === "9");
  const splitAt = isCellphone ? 5 : 4;
  if (rest.length <= splitAt) return `(${ddd}) ${rest}`;
  return `(${ddd}) ${rest.slice(0, splitAt)}-${rest.slice(splitAt)}`;
}

export function isValidBrazilianPhone(value: string): boolean {
  const digits = onlyPhoneDigits(value);
  if (digits.length !== 10 && digits.length !== 11) return false;
  const ddd = Number(digits.slice(0, 2));
  if (!VALID_DDDS.has(ddd)) return false;
  const firstDigit = digits[2];
  // Celular (11 dígitos) sempre começa com 9; fixo (10) nunca começa com 0/1.
  if (digits.length === 11) return firstDigit === "9";
  return firstDigit !== "0" && firstDigit !== "1";
}
