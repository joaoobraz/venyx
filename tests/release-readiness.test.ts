import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("release gate invokes package scripts through the run command", () => {
  const source = readFileSync(new URL("../scripts/release-readiness.mjs", import.meta.url), "utf8");

  assert.match(source, /\[packageManagerScript, "run", \.\.\.args\]/u);
  assert.match(source, /\["run", \.\.\.args\]/u);
  assert.doesNotMatch(source, /\[packageManagerScript, \.\.\.args\]/u);
});
