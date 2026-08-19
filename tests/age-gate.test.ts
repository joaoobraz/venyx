import assert from "node:assert/strict";
import test from "node:test";
import { requiresAgeGate } from "../src/lib/age-gate.ts";

test("protege a página inicial e áreas de conteúdo adulto", () => {
  assert.equal(requiresAgeGate("/"), true);
  assert.equal(requiresAgeGate("/feed"), true);
  assert.equal(requiresAgeGate("/profile/aline"), true);
});

test("mantém documentos legais, ajuda e autenticação acessíveis", () => {
  assert.equal(requiresAgeGate("/termos"), false);
  assert.equal(requiresAgeGate("/privacy"), false);
  assert.equal(requiresAgeGate("/dmca"), false);
  assert.equal(requiresAgeGate("/login"), false);
  assert.equal(requiresAgeGate("/auth/callback?code=segredo"), false);
});
