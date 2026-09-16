import assert from "node:assert/strict";
import test from "node:test";
import { applySinglePinnedPost } from "../src/lib/post-pinning-policy.ts";

test("mantém somente uma publicação fixada por modelo", () => {
  const posts = applySinglePinnedPost(
    [
      { id: "post-1", is_pinned: true },
      { id: "post-2", is_pinned: false },
      { id: "post-3" },
    ],
    "post-2",
  );

  assert.deepEqual(
    posts.map((post) => [post.id, post.is_pinned]),
    [
      ["post-1", false],
      ["post-2", true],
      ["post-3", false],
    ],
  );
});

test("permite desafixar a publicação atual", () => {
  const posts = applySinglePinnedPost([{ id: "post-1", is_pinned: true }], null);
  assert.equal(posts[0].is_pinned, false);
});
