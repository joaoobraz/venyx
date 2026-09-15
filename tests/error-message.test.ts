import assert from "node:assert/strict";
import test from "node:test";
import { describeError } from "../src/lib/error-message.ts";

const tr = (pt: string) => pt;

test("erro do Supabase não é instância de Error e mesmo assim explica a causa", () => {
  const supabaseError = {
    code: "42501",
    message: "permission denied for table posts",
    details: null,
    hint: null,
  };
  const message = describeError(supabaseError, tr);
  assert.ok(!(supabaseError instanceof Error));
  assert.match(message, /permissão/i);
  assert.doesNotMatch(message, /^Erro$/);
});

test("regras de negócio do banco viram orientação acionável", () => {
  assert.match(
    describeError({ message: "VENYX_PIX_KEY_REQUIRED" }, tr),
    /chave Pix/i,
  );
  assert.match(
    describeError({ message: "VENYX_CREATOR_PROFILE_REQUIRED" }, tr),
    /20 caracteres/i,
  );
  assert.match(
    describeError({ message: "VENYX_KYC_REQUIRED" }, tr),
    /verificação de criadora/i,
  );
});

test("falha interna do banco pede suporte e preserva o detalhe técnico", () => {
  const message = describeError(
    { code: "42703", message: 'record "new" has no field "media_path"' },
    tr,
  );
  assert.match(message, /suporte/i);
  assert.match(message, /media_path/);
});

test("queda de rede não é confundida com erro de preenchimento", () => {
  assert.match(describeError(new TypeError("Failed to fetch"), tr), /conexão/i);
});

test("erro sem mensagem ainda devolve uma frase compreensível", () => {
  const message = describeError({}, tr);
  assert.match(message, /Não foi possível concluir/i);
  assert.doesNotMatch(message, /undefined/);
});
