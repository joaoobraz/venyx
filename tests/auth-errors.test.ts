import assert from "node:assert/strict";
import test from "node:test";
import { getPasswordLoginError } from "../src/lib/auth-errors.ts";

test("explica que a senha do Google não autentica o login por senha da Venyx", () => {
  assert.equal(
    getPasswordLoginError({ code: "invalid_credentials", message: "Invalid login credentials" }),
    "E-mail ou senha da Venyx inválidos. A senha do Gmail não funciona neste campo.",
  );
});

test("orienta a confirmação de e-mail em português e inglês", () => {
  assert.equal(
    getPasswordLoginError({ code: "email_not_confirmed" }),
    "Confirme seu e-mail antes de entrar na Venyx.",
  );
  assert.equal(
    getPasswordLoginError({ code: "email_not_confirmed" }, "en"),
    "Confirm your email before signing in to Venyx.",
  );
});
