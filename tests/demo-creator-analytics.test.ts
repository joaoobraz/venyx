import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveAnalyticsPeriod,
  summarizeCreatorAnalytics,
  validateAnalyticsRange,
} from "../src/lib/demo-creator-analytics.ts";
import {
  classifyVisitAttribution,
  distributeVisitSources,
  visitAttributionMetadata,
  withFanliraLinkAttribution,
} from "../src/lib/visit-attribution.ts";

const now = new Date(2026, 7, 4, 12);

test("resolve hoje, ontem e períodos inclusivos", () => {
  assert.deepEqual(resolveAnalyticsPeriod("today", now), {
    startDate: "2026-08-04",
    endDate: "2026-08-04",
  });
  assert.deepEqual(resolveAnalyticsPeriod("yesterday", now), {
    startDate: "2026-08-03",
    endDate: "2026-08-03",
  });
  const sevenDays = resolveAnalyticsPeriod("last_7_days", now);
  assert.equal(summarizeCreatorAnalytics({ range: sevenDays }).days, 7);
});

test("valida intervalo personalizado", () => {
  assert.equal(
    validateAnalyticsRange({ startDate: "2026-02-31", endDate: "2026-08-03" }, now),
    "invalid",
  );
  assert.equal(
    validateAnalyticsRange({ startDate: "2026-08-04", endDate: "2026-08-03" }, now),
    "inverted",
  );
  assert.equal(
    validateAnalyticsRange({ startDate: "2026-08-01", endDate: "2026-08-05" }, now),
    "future",
  );
  assert.equal(
    validateAnalyticsRange({ startDate: "2026-08-01", endDate: "2026-08-04" }, now),
    null,
  );
});

test("todos os indicadores mudam com o período e incluem eventos locais na data correta", () => {
  const today = resolveAnalyticsPeriod("today", now);
  const lastSeven = resolveAnalyticsPeriod("last_7_days", now);
  const base = summarizeCreatorAnalytics({ range: today });
  const withEvents = summarizeCreatorAnalytics({
    range: today,
    purchases: [
      {
        kind: "ppv",
        amount_cents: 1990,
        status: "paid",
        created_at: "2026-08-04T10:00:00-03:00",
      },
      {
        kind: "subscription",
        amount_cents: 4990,
        status: "paid",
        created_at: "2026-07-01T10:00:00-03:00",
      },
    ],
    tips: [
      {
        amount_cents: 5000,
        payment_status: "paid",
        created_at: "2026-08-04T11:00:00-03:00",
      },
    ],
  });
  assert.equal(withEvents.revenueCents - base.revenueCents, 6990);
  assert.equal(withEvents.ppvSold - base.ppvSold, 1);
  assert.equal(withEvents.tipsReceived - base.tipsReceived, 1);
  assert.ok(summarizeCreatorAnalytics({ range: lastSeven }).visits > base.visits);
  assert.ok(summarizeCreatorAnalytics({ range: lastSeven }).messages > base.messages);
});

test("atribui uma unica origem usando a evidencia mais especifica", () => {
  const classify = (landingUrl: string, referrer = "") =>
    classifyVisitAttribution({
      landingUrl,
      referrer,
      siteOrigin: "https://fanlira.com.br",
    }).source;

  assert.equal(classify("https://fanlira.com.br/c/BEMVINDA?utm_campaign=launch"), "coupons");
  assert.equal(classify("https://fanlira.com.br/profile/aline?utm_campaign=launch"), "campaigns");
  assert.equal(classify("https://fanlira.com.br/profile/aline?via=venyx_links"), "venyx_links");
  assert.equal(
    classify("https://fanlira.com.br/profile/aline", "https://fanlira.com.br/search?q=aline"),
    "venyx_search",
  );
  assert.equal(
    classify("https://fanlira.com.br/profile/aline?utm_medium=creator_link"),
    "creator_links",
  );
  assert.equal(classify("https://fanlira.com.br/profile/aline?utm_source=instagram"), "social");
  assert.equal(
    classify("https://fanlira.com.br/profile/aline", "https://l.instagram.com/redirect"),
    "social",
  );
  assert.equal(classify("https://fanlira.com.br/profile/aline", "https://example.com/article"), "other");
  assert.equal(classify("https://fanlira.com.br/profile/aline"), "direct");
});

test("nao expoe URL completa nem codigo do cupom e preserva o total de visitas", () => {
  const metadata = visitAttributionMetadata({
    landingUrl: "https://fanlira.com.br/c/SEGREDO?coupon_code=SEGREDO",
    referrer: "https://example.com/private/path?token=secret",
  });
  assert.equal(metadata.visitSource, "coupons");
  assert.equal("couponCode" in metadata, false);
  assert.equal(metadata.referrerHost, "example.com");

  const sources = distributeVisitSources(8_145);
  assert.equal(
    Object.values(sources).reduce((total, value) => total + value, 0),
    8_145,
  );
  assert.ok(Object.values(sources).every((value) => value > 0));

  assert.equal(
    withFanliraLinkAttribution("/profile/aline?from=bio", "https://fanlira.com.br"),
    "/profile/aline?from=bio&via=venyx_links",
  );
  assert.equal(
    withFanliraLinkAttribution("https://instagram.com/aline", "https://fanlira.com.br"),
    "https://instagram.com/aline",
  );
});
