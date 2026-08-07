import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeProfileVisibility,
  profileVisibilityFromDatabase,
  profileVisibilityToDatabase,
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

test("legacy regional blocking values are ignored and cleared", () => {
  const visibility = normalizeProfileVisibility({
    showAge: false,
    blockedStates: ["SP", "MG"],
  });
  assert.equal(visibility.showAge, false);
  assert.equal(visibility.showBio, true);
  assert.deepEqual(visibility.blockedStates, []);
  assert.deepEqual(
    profileVisibilityFromDatabase({ show_age: false, blocked_states: ["SP", "MG"] })
      .blockedStates,
    [],
  );
  assert.deepEqual(profileVisibilityToDatabase("creator-1", visibility).blocked_states, []);
});
