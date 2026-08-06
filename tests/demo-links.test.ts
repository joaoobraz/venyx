import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDemoTrackingUrl,
  createDemoLinksSeed,
  createDemoTrackingLink,
  demoTrackingLinkAvailable,
} from "../src/lib/demo-links.ts";
import { classifyVisitAttribution } from "../src/lib/visit-attribution.ts";

const origin = "https://venyx.example";

test("Fanlira Links starts with four editable suggestions", () => {
  const state = createDemoLinksSeed();
  assert.deepEqual(
    state.links.map((link) => link.title),
    ["Minha Lista de Mimos", "Meu perfil na Fanlira", "Instagram", "TikTok"],
  );
  assert.equal(state.page.isPublished, true);
});

test("social tracking links feed the social Analytics source", () => {
  const link = createDemoTrackingLink({
    name: "Bio Instagram",
    channel: "instagram",
    destinationUrl: "/profile/aline",
    content: "bio",
  });
  const url = buildDemoTrackingUrl(link, origin);
  const result = classifyVisitAttribution({ landingUrl: url, siteOrigin: origin });

  assert.equal(result.source, "social");
  assert.equal(result.method, "social_parameter");
  assert.equal(result.utmSource, "instagram");
});

test("ad tracking links feed campaigns and preserve UTM identifiers", () => {
  const link = createDemoTrackingLink({
    name: "Meta Agosto",
    channel: "meta_ads",
    destinationUrl: "/profile/aline",
    campaign: "lancamento_agosto",
    content: "criativo_01",
  });
  const url = buildDemoTrackingUrl(link, origin);
  const result = classifyVisitAttribution({ landingUrl: url, siteOrigin: origin });

  assert.equal(result.source, "campaigns");
  assert.equal(result.method, "utm_campaign");
  assert.equal(result.utmCampaign, "lancamento_agosto");
});

test("coupon tracking links keep coupon priority and temporary links expire", () => {
  const link = createDemoTrackingLink({
    name: "Cupom VIP",
    channel: "coupon",
    destinationUrl: "/profile/aline",
    campaign: "agosto",
    couponCode: "vip20",
    expiresAt: "2026-08-10",
  });
  const url = buildDemoTrackingUrl(link, origin);
  const result = classifyVisitAttribution({ landingUrl: url, siteOrigin: origin });

  assert.match(url, /\/c\/VIP20/);
  assert.equal(result.source, "coupons");
  assert.equal(result.method, "coupon");
  assert.equal(demoTrackingLinkAvailable(link, new Date("2026-08-10T12:00:00")), true);
  assert.equal(demoTrackingLinkAvailable(link, new Date("2026-08-11T00:00:00")), false);
});
