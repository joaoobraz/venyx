import assert from "node:assert/strict";
import test from "node:test";
import {
  CAMPAIGN_AUDIENCES,
  CAMPAIGN_DAILY_LIMIT,
  CAMPAIGN_OBJECTIVES,
  estimateCampaignAudience,
  simulateCampaignReport,
  validateCampaignDraft,
} from "../src/lib/mass-campaign.ts";

test("mass campaigns expose every requested objective", () => {
  assert.equal(CAMPAIGN_OBJECTIVES.length, 12);
  assert.deepEqual(
    CAMPAIGN_OBJECTIVES.map((item) => item.id),
    [
      "discount",
      "promotion",
      "specific_content",
      "library_photo",
      "new_photo",
      "video",
      "audio",
      "ppv",
      "coupon",
      "renewal",
      "recovery",
      "custom",
    ],
  );
});

test("privacy-sensitive audiences remain disabled for delivery", () => {
  const protectedAudiences = CAMPAIGN_AUDIENCES.filter((item) => item.privacyReview);
  assert.deepEqual(
    protectedAudiences.map((item) => item.id),
    ["profile_viewers", "unpaid_pix"],
  );
  assert.ok(protectedAudiences.every((item) => item.estimate === 0));
});

test("manual audience uses the explicitly selected lead count", () => {
  assert.equal(estimateCampaignAudience("manual", 7), 7);
  assert.equal(estimateCampaignAudience("active_subscribers", 7), 327);
});

test("campaign validation enforces content, PPV value, recipients, schedule and daily limit", () => {
  const errors = validateCampaignDraft({
    title: "",
    objective: "ppv",
    audience: "active_subscribers",
    body: "",
    mediaUrl: null,
    ppvPriceCents: 0,
    recipients: CAMPAIGN_DAILY_LIMIT + 1,
    scheduledAt: new Date(Date.now() - 60_000).toISOString(),
  });
  assert.equal(errors.length, 5);
  assert.ok(errors.some((error) => error.includes("nome da campanha")));
  assert.ok(errors.some((error) => error.includes("mensagem ou uma mídia")));
  assert.ok(errors.some((error) => error.includes("PPV")));
  assert.ok(errors.some((error) => error.includes("limite diário")));
  assert.ok(errors.some((error) => error.includes("horário futuro")));
});

test("campaign report keeps delivery, opens and sales internally consistent", () => {
  const report = simulateCampaignReport(200, "ppv");
  assert.ok(report.delivered <= 200);
  assert.ok(report.opened <= report.delivered);
  assert.ok(report.sales <= report.opened);
  assert.ok(report.sales > 0);
});
