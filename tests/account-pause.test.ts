import assert from "node:assert/strict";
import test from "node:test";
import { readDemoAccountPause, setDemoAccountPaused } from "../src/lib/account-pause.ts";

test("pausa e reativa a conta sem apagar o histórico do estado", () => {
  const values = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
  Object.defineProperty(globalThis, "window", {
    value: { localStorage, dispatchEvent: () => true },
    configurable: true,
  });

  assert.equal(readDemoAccountPause("user-pause").paused, false);
  const paused = setDemoAccountPaused("user-pause", true);
  assert.equal(paused.paused, true);
  assert.ok(paused.pausedAt);

  const active = setDemoAccountPaused("user-pause", false);
  assert.equal(active.paused, false);
  assert.equal(active.pausedAt, paused.pausedAt);
  assert.ok(active.reactivatedAt);

  Reflect.deleteProperty(globalThis, "window");
});
