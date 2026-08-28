import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { DEMO_CREATORS } from "../src/lib/demo-creators.ts";

const EXPECTED_USERNAMES = [
  "aline",
  "duda",
  "lara",
  "bia",
  "camila",
  "marina",
  "isabela",
  "natalia",
  "rafaela",
  "valentina",
  "carolina",
  "sofia",
  "thalia",
  "julia",
  "kaira",
];

test("mantém o Top 15 completo, ordenado e com perfis adultos", () => {
  assert.equal(DEMO_CREATORS.length, 15);
  assert.deepEqual(
    DEMO_CREATORS.map((creator) => creator.username),
    EXPECTED_USERNAMES,
  );
  assert.deepEqual(
    DEMO_CREATORS.map((creator) => creator.rank),
    Array.from({ length: 15 }, (_, index) => index + 1),
  );

  for (const creator of DEMO_CREATORS) {
    assert.ok(creator.age >= 21);
    assert.ok(creator.bio.length > 20);
    assert.ok(creator.bio_en.length > 20);
    assert.ok(creator.location.length > 2);
    assert.ok(creator.category.length > 2);
    assert.ok(creator.subscription_price_cents > 0);
    assert.ok(creator.subscribers_count > 0);
    assert.ok(creator.likes_count > 0);
    assert.ok(creator.posts_count > 0);
  }
});

test("usa identificadores e retratos locais exclusivos", async () => {
  assert.equal(new Set(DEMO_CREATORS.map((creator) => creator.user_id)).size, 15);
  assert.equal(new Set(DEMO_CREATORS.map((creator) => creator.username)).size, 15);
  assert.equal(new Set(DEMO_CREATORS.map((creator) => creator.avatar_url)).size, 15);

  const hashes = await Promise.all(
    DEMO_CREATORS.map(async (creator) => {
      assert.match(creator.avatar_url, /^\/demo-creators\/[a-z]+-investor\.webp$/);
      const file = await readFile(
        path.join(process.cwd(), "public", creator.avatar_url.replace(/^\//, "")),
      );
      return createHash("sha256").update(file).digest("hex");
    }),
  );
  assert.equal(new Set(hashes).size, 15);
});

test("mantém a apresentação bloqueada por ambiente", async () => {
  const source = await readFile(
    path.join(process.cwd(), "src", "lib", "demo-creators.ts"),
    "utf8",
  );
  assert.match(source, /APP_ENV === "staging"/);
  assert.doesNotMatch(source, /APP_ENV === "production"/);
  assert.match(source, /IS_PRESENTATION_ENV\s*&&/);
});
