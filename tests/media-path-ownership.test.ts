import assert from "node:assert/strict";
import test from "node:test";
import { isOwnedMediaPath } from "../src/lib/media-path.ts";

const owner = "0b3a2a4e-1111-4c2d-9c4e-aaaaaaaaaaaa";
const other = "9f9f9f9f-2222-4c2d-9c4e-bbbbbbbbbbbb";

test("aceita caminho dentro da pasta do dono", () => {
  assert.equal(isOwnedMediaPath(owner, `${owner}/post-1/0.jpg`), true);
  assert.equal(isOwnedMediaPath(owner, `${owner}/1725000000000.mp4`), true);
});

test("recusa caminho de outra criadora (bypass de PPV)", () => {
  assert.equal(isOwnedMediaPath(owner, `${other}/post-9/0.jpg`), false);
});

test("recusa truques de caminho", () => {
  assert.equal(isOwnedMediaPath(owner, `${owner}/../${other}/post-9/0.jpg`), false);
  assert.equal(isOwnedMediaPath(owner, `${owner}`), false);
  assert.equal(isOwnedMediaPath(owner, `${owner}/`), false);
  assert.equal(isOwnedMediaPath(owner, `/${owner}/post-1/0.jpg`), false);
  assert.equal(isOwnedMediaPath(owner, `${owner}x/post-1/0.jpg`), false);
  assert.equal(isOwnedMediaPath(owner, null), false);
  assert.equal(isOwnedMediaPath(null, `${owner}/post-1/0.jpg`), false);
});
