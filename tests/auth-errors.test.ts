import assert from "node:assert/strict";
import test from "node:test";
import { getPasswordLoginError } from "../src/lib/auth-errors.ts";

test("retorna uma mensagem neutra para credenciais inválidas", () => {
  assert.equal(
    getPasswordLoginError({ code: "invalid_credentials", message: "Invalid login credentials" }),
    "E-mail ou senha inválidos.",
  );
});

test("orienta a confirmação de e-mail em português e inglês", () => {
  assert.equal(
    getPasswordLoginError({ code: "email_not_confirmed" }),
    "Confirme seu e-mail antes de entrar na Fanlira.",
  );
  assert.equal(
    getPasswordLoginError({ code: "email_not_confirmed" }, "en"),
    "Confirm your email before signing in to Fanlira.",
  );
});
