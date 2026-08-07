import assert from "node:assert/strict";
import test from "node:test";
import {
  extractBrazilState,
  isViewerStateBlocked,
  normalizeBrazilState,
  normalizeProfileVisibility,
  resolveOwnProfileUsername,
} from "../src/lib/profile-visibility.ts";

test("creator demo mode always resolves to Aline's profile", () => {
  assert.equal(
    resolveOwnProfileUsername({
      authenticatedUserId: "lead-1",
      profileUserId: "lead-1",
      profileUsername: "joaobrazofc",
      isCreator: false,
      demoPreviewRole: "creator",
    }),
    "aline",
  );
});

test("real profile destination requires the authenticated user id", () => {
  assert.equal(
    resolveOwnProfileUsername({
      authenticatedUserId: "creator-1",
      profileUserId: "creator-1",
      profileUsername: "aline-real",
      isCreator: true,
      demoPreviewRole: null,
    }),
    "aline-real",
  );
  assert.equal(
    resolveOwnProfileUsername({
      authenticatedUserId: "creator-1",
      profileUserId: "another-user",
      profileUsername: "joaobraz",
      isCreator: true,
      demoPreviewRole: null,
    }),
    null,
  );
});

test("Brazilian state is extracted only from a valid location suffix", () => {
  assert.equal(extractBrazilState("São Paulo, SP"), "SP");
  assert.equal(extractBrazilState("Curitiba PR"), "PR");
  assert.equal(extractBrazilState("Belo Horizonte, Minas Gerais"), "MG");
  assert.equal(normalizeBrazilState("Minas Gerais"), "MG");
  assert.equal(extractBrazilState("Lisboa, PT"), null);
});

test("state blocking is normalized and evaluated", () => {
  const visibility = normalizeProfileVisibility({
    showAge: false,
    blockedStates: ["sp" as "SP", "SP", "XX" as "SP"],
  });
  assert.equal(visibility.showAge, false);
  assert.equal(visibility.showBio, true);
  assert.deepEqual(visibility.blockedStates, ["SP"]);
  assert.equal(isViewerStateBlocked(visibility, "Campinas, SP"), true);
  assert.equal(isViewerStateBlocked(visibility, "Rio de Janeiro, RJ"), false);
  assert.equal(isViewerStateBlocked(visibility, "Rio de Janeiro, RJ", "SP"), true);
});
