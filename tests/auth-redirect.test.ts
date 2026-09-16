import assert from "node:assert/strict";
import test from "node:test";
import {
  createOAuthCallbackUrl,
  getOAuthErrorFromUrl,
  getSafeAuthRedirectPath,
} from "../src/lib/auth-redirect.ts";

test("cria o retorno OAuth para a origem local e preserva o destino", () => {
  assert.equal(
    createOAuthCallbackUrl("http://localhost:8080", "/feed?tab=following"),
    "http://localhost:8080/auth/callback?next=%2Ffeed%3Ftab%3Dfollowing",
  );
});

test("aceita apenas destinos internos depois do login", () => {
  assert.equal(getSafeAuthRedirectPath("/creator/posts?draft=1"), "/creator/posts?draft=1");
  assert.equal(getSafeAuthRedirectPath("https://example.com"), "/feed");
  assert.equal(getSafeAuthRedirectPath("//example.com"), "/feed");
});

test("lê erros OAuth enviados na busca ou no fragmento", () => {
  assert.equal(
    getOAuthErrorFromUrl("http://localhost:8080/auth/callback?error_description=Acesso+negado"),
    "Acesso negado",
  );
  assert.equal(
    getOAuthErrorFromUrl("http://localhost:8080/auth/callback#error=access_denied"),
    "access_denied",
  );
});
