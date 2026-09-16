import test from "node:test";
import assert from "node:assert/strict";
import {
  PIXEL_PROVIDERS,
  createEmptyPixelConfigs,
  enabledValidPixels,
  mergePixelConfigs,
  normalizePixelId,
  validatePixelId,
  type CreatorPixelConfig,
  type PixelProvider,
} from "../src/lib/creator-pixels.ts";

const validIds: Record<PixelProvider, string> = {
  meta: "123456789012345",
  google_analytics: "G-ABC123XYZ9",
  google_ads: "AW-123456789",
  tiktok: "C1234567890ABCDEF123",
  pinterest: "1234567890123",
  snapchat: "12345678-1234-1234-1234-1234567890ab",
};

test("supports the main advertising and analytics platforms", () => {
  assert.deepEqual(PIXEL_PROVIDERS, [
    "meta",
    "google_analytics",
    "google_ads",
    "tiktok",
    "pinterest",
    "snapchat",
  ]);
  assert.equal(createEmptyPixelConfigs().length, 6);
});

test("validates and normalizes each platform identifier", () => {
  for (const provider of PIXEL_PROVIDERS) {
    assert.equal(validatePixelId(provider, validIds[provider]).valid, true, provider);
  }
  assert.equal(normalizePixelId("google_analytics", " g-abc123xyz9 "), "G-ABC123XYZ9");
  assert.equal(normalizePixelId("meta", "123 456 789"), "123456789");
});

test("rejects identifiers that belong to a different platform", () => {
  assert.equal(validatePixelId("meta", validIds.tiktok).valid, false);
  assert.equal(validatePixelId("google_ads", validIds.google_analytics).valid, false);
  assert.equal(validatePixelId("snapchat", "12345").valid, false);
});

test("only enables integrations with valid IDs", () => {
  const configs = createEmptyPixelConfigs().map((config): CreatorPixelConfig => ({
    ...config,
    enabled: true,
    pixelId: config.provider === "meta" ? validIds.meta : "invalid",
  }));
  assert.deepEqual(
    enabledValidPixels(configs).map((config) => config.provider),
    ["meta"],
  );
});

test("merges saved settings with newly supported platforms", () => {
  const merged = mergePixelConfigs([
    {
      provider: "tiktok",
      pixelId: validIds.tiktok,
      enabled: true,
      trackPageViews: false,
      trackLinkClicks: true,
      lastValidatedAt: "2026-08-04T12:00:00.000Z",
    },
  ]);
  assert.equal(merged.length, 6);
  assert.equal(merged.find((config) => config.provider === "tiktok")?.enabled, true);
  assert.equal(merged.find((config) => config.provider === "meta")?.enabled, false);
});
