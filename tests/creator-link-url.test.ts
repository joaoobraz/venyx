import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCreatorLinkUrl } from "../src/lib/creator-link-url.ts";

test("normaliza domínio sem protocolo para HTTPS", () => {
  assert.equal(normalizeCreatorLinkUrl("instagram.com/venyx"), "https://instagram.com/venyx");
});

test("aceita HTTP local e HTTPS externo", () => {
  assert.equal(
    normalizeCreatorLinkUrl("http://localhost:8080/profile/aline"),
    "http://localhost:8080/profile/aline",
  );
  assert.equal(normalizeCreatorLinkUrl("https://fanlira.com.br"), "https://fanlira.com.br/");
});

test("bloqueia protocolos executáveis e credenciais embutidas", () => {
  assert.equal(normalizeCreatorLinkUrl("javascript:alert(1)"), null);
  assert.equal(normalizeCreatorLinkUrl("data:text/html,oi"), null);
  assert.equal(normalizeCreatorLinkUrl("https://usuario:senha@example.com"), null);
});
