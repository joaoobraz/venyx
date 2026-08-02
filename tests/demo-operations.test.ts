import assert from "node:assert/strict";
import test from "node:test";
import {
  isDemoPpvUnlocked,
  readDemoOperations,
  recordDemoPurchase,
  recordDemoReport,
  resetDemoExperience,
} from "../src/lib/demo-operations.ts";

function installLocalStorage() {
  const values = new Map<string, string>();
  const storage = {
    get length() { return values.size; },
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    key: (index: number) => Array.from(values.keys())[index] ?? null,
  };
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
  Object.defineProperty(globalThis, "window", { value: { dispatchEvent: () => true }, configurable: true });
  return values;
}

function cleanup() {
  Reflect.deleteProperty(globalThis, "localStorage");
  Reflect.deleteProperty(globalThis, "window");
}

test("sincroniza compra PPV e denúncia entre os papéis locais", () => {
  installLocalStorage();

  recordDemoPurchase({
    kind: "ppv",
    buyer_id: "viewer-1",
    creator_id: "demo-marina",
    creator_name: "Marina",
    reference_id: "demo-post-marina-jantar",
    label: "Conteúdo PPV",
    amount_cents: 1490,
  });
  recordDemoReport({
    userId: "viewer-1",
    targetType: "post",
    targetId: "demo-post-marina-jantar",
    targetUserId: "demo-marina",
    targetLabel: "@marina",
    reason: "spam",
    details: "Teste local",
  });

  const state = readDemoOperations("viewer-1");
  assert.equal(isDemoPpvUnlocked("viewer-1", "demo-post-marina-jantar"), true);
  assert.equal(state.purchases[0]?.amount_cents, 1490);
  assert.equal(state.reports[0]?.target_label, "@marina");
  assert.equal(state.reports[0]?.status, "pending");
  cleanup();
});

test("restaura os dados da demonstração sem remover preferências comuns", () => {
  const values = installLocalStorage();
  values.set("theme", "dark");
  values.set("venyx:demo-preview-role:user@example.com", "creator");
  values.set("venyx-demo-liked-posts:viewer-1", "[\"post\"]");
  values.set("venyx:presentation:wishlist:v1:viewer-1", "[]");

  resetDemoExperience("viewer-1");

  assert.equal(values.get("theme"), "dark");
  assert.equal(values.get("venyx:demo-preview-role:user@example.com"), "creator");
  assert.equal(values.has("venyx-demo-liked-posts:viewer-1"), false);
  assert.equal(readDemoOperations("viewer-1").creatorPosts.length, 3);
  cleanup();
});
