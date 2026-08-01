import assert from "node:assert/strict";
import test from "node:test";
import { verifyNexusPagSignature } from "../src/_server/nexuspag-webhook-security.ts";

async function sign(rawBody: string, secret: string, timestamp: number) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${rawBody}`)),
  );
  const hex = Array.from(signature, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `t=${timestamp},v1=${hex}`;
}

test("aceita uma assinatura NexusPag válida e recente", async () => {
  const body = '{"event":"payment.confirmed","external_id":"order-1"}';
  const timestamp = 1_800_000_000;
  const header = await sign(body, "test-secret", timestamp);
  assert.equal(await verifyNexusPagSignature(body, header, "test-secret", timestamp), true);
});

test("rejeita corpo adulterado, assinatura antiga e formato inválido", async () => {
  const body = '{"event":"payment.confirmed","external_id":"order-1"}';
  const timestamp = 1_800_000_000;
  const header = await sign(body, "test-secret", timestamp);
  assert.equal(await verifyNexusPagSignature(`${body} `, header, "test-secret", timestamp), false);
  assert.equal(await verifyNexusPagSignature(body, header, "test-secret", timestamp + 301), false);
  assert.equal(
    await verifyNexusPagSignature(body, "t=abc,v1=123", "test-secret", timestamp),
    false,
  );
});
