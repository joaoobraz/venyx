import assert from "node:assert/strict";
import test from "node:test";
import { redactTelemetryText, sanitizeTelemetryMetadata } from "../src/lib/telemetry-safety.ts";

test("redacts email, bearer token, JWT and long document numbers", () => {
  const text = redactTelemetryText(
    "user@example.com Bearer abc.def.ghi eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature 12345678901",
  );
  assert.equal(text.includes("user@example.com"), false);
  assert.equal(text.includes("12345678901"), false);
  assert.match(text, /\[email\]/);
  assert.match(text, /\[token\]|Bearer \[redacted\]/);
});

test("redacts sensitive keys at every nested level", () => {
  const value = sanitizeTelemetryMetadata({
    email: "owner@example.com",
    safe: "checkout",
    nested: { password: "secret", pix_key: "12345678901", note: "ok" },
  }) as Record<string, unknown>;
  assert.equal(value.email, "[redacted]");
  assert.equal(value.safe, "checkout");
  assert.deepEqual(value.nested, { password: "[redacted]", pix_key: "[redacted]", note: "ok" });
});

test("limits telemetry depth, collection size and text length", () => {
  const value = sanitizeTelemetryMetadata({
    deep: { a: { b: { c: { d: "must not survive" } } } },
    list: Array.from({ length: 30 }, (_, index) => index),
    long: "x".repeat(900),
  }) as { deep: unknown; list: unknown[]; long: string };
  assert.deepEqual(value.deep, { a: { b: { c: "[truncated]" } } });
  assert.equal(value.list.length, 20);
  assert.equal(value.long.length, 500);
});
