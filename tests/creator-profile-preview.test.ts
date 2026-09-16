import assert from "node:assert/strict";
import test from "node:test";
import {
  canPreviewOwnProfileAsClient,
  previewOnlyMessage,
} from "../src/lib/creator-profile-preview.ts";

test("creator demo can preview Aline only", () => {
  assert.equal(
    canPreviewOwnProfileAsClient({
      requested: true,
      authenticatedUserId: "lead-1",
      profileUserId: "demo-aline",
      isCreator: false,
      demoPreviewRole: "creator",
    }),
    true,
  );
  assert.equal(
    canPreviewOwnProfileAsClient({
      requested: true,
      authenticatedUserId: "lead-1",
      profileUserId: "demo-lara",
      isCreator: false,
      demoPreviewRole: "creator",
    }),
    false,
  );
});

test("real creator preview requires an exact authenticated user id match", () => {
  assert.equal(
    canPreviewOwnProfileAsClient({
      requested: true,
      authenticatedUserId: "creator-1",
      profileUserId: "creator-1",
      isCreator: true,
      demoPreviewRole: null,
    }),
    true,
  );
  assert.equal(
    canPreviewOwnProfileAsClient({
      requested: true,
      authenticatedUserId: "creator-1",
      profileUserId: "creator-2",
      isCreator: true,
      demoPreviewRole: null,
    }),
    false,
  );
});

test("preview warning is explicit about its read-only behavior", () => {
  assert.match(previewOnlyMessage("pt-BR"), /Nenhuma interação, compra ou assinatura/);
  assert.match(previewOnlyMessage("en"), /No interaction, purchase or subscription/);
});
