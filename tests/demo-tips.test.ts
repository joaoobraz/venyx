import assert from "node:assert/strict";
import test from "node:test";
import { getDemoTipTotal, readDemoTips, recordDemoTip } from "../src/lib/demo-tips.ts";

test("registra e soma mimos somente no armazenamento local", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
  Object.defineProperty(globalThis, "window", {
    value: { dispatchEvent: () => true },
    configurable: true,
  });

  recordDemoTip({
    userId: "viewer-1",
    creatorId: "demo-aline",
    creatorName: "Aline",
    senderName: "João",
    amountCents: 2500,
    message: "Adorei o conteúdo!",
  });
  recordDemoTip({
    userId: "viewer-1",
    creatorId: "demo-aline",
    creatorName: "Aline",
    senderName: "João",
    amountCents: 1000,
  });

  assert.equal(readDemoTips("viewer-1").length, 2);
  assert.equal(getDemoTipTotal("viewer-1"), 3500);
  assert.equal(readDemoTips("viewer-1")[0]?.message, "Adorei o conteúdo!");
  assert.equal(readDemoTips("viewer-1")[0]?.payment_method, "demo_balance");
  assert.equal(readDemoTips("viewer-1")[0]?.sender_name, "João");

  Reflect.deleteProperty(globalThis, "localStorage");
  Reflect.deleteProperty(globalThis, "window");
});
