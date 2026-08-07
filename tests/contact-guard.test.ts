import assert from "node:assert/strict";
import test from "node:test";
import { detectExternalContact } from "../src/lib/contact-guard.ts";

test("chat contact guard blocks phone and WhatsApp sharing attempts", () => {
  assert.equal(detectExternalContact("me chama no wpp").blocked, true);
  assert.equal(detectExternalContact("meu número é 11 99999-8888").blocked, true);
  assert.equal(detectExternalContact("+55 (11) 99999-8888").blocked, true);
});

test("chat contact guard allows regular messages inside the platform", () => {
  assert.equal(detectExternalContact("Oi, gostei do seu conteúdo aqui na Fanlira").blocked, false);
});
