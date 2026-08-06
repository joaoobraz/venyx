import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateCouponPrice,
  couponPostOfferPrice,
  couponRemainingSlots,
  evaluateCouponAvailability,
  type CouponOfferLike,
} from "../src/lib/coupon-offers.ts";

function offer(overrides: Partial<CouponOfferLike> = {}): CouponOfferLike {
  return {
    benefit_type: "special_price",
    promotional_price_cents: 1_990,
    normal_price_cents: 4_900,
    auto_renew_after_trial: false,
    max_uses: 10,
    uses: 7,
    reserved_uses: 1,
    max_uses_per_user: 1,
    used_by_user_ids: [],
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    eligibility: "new_subscribers",
    active: true,
    ...overrides,
  };
}

test("a oferta de R$ 19,90 para os 10 primeiros conta usos e PIX reservados", () => {
  const coupon = offer();
  assert.equal(calculateCouponPrice(coupon), 1_990);
  assert.equal(couponPostOfferPrice(coupon), 4_900);
  assert.equal(couponRemainingSlots(coupon), 2);
});

test("a 11ª pessoa não entra quando usos confirmados e reservas completam as vagas", () => {
  const coupon = offer({ uses: 9, reserved_uses: 1 });
  assert.equal(couponRemainingSlots(coupon), 0);
  assert.deepEqual(
    evaluateCouponAvailability(coupon, {
      userId: "lead-11",
      wasSubscriber: false,
      isActiveSubscriber: false,
    }),
    { available: false, reason: "sold_out" },
  );
});

test("o mesmo usuário só utiliza a oferta uma vez", () => {
  const result = evaluateCouponAvailability(offer({ used_by_user_ids: ["lead-1"] }), {
    userId: "lead-1",
    wasSubscriber: false,
    isActiveSubscriber: false,
  });
  assert.deepEqual(result, { available: false, reason: "already_used" });
});

test("oferta expirada volta ao preço normal", () => {
  const coupon = offer({ expires_at: new Date(Date.now() - 1_000).toISOString() });
  const result = evaluateCouponAvailability(coupon, {
    userId: "lead-2",
    wasSubscriber: false,
    isActiveSubscriber: false,
  });
  assert.deepEqual(result, { available: false, reason: "expired" });
  assert.equal(couponPostOfferPrice(coupon), 4_900);
});

test("desconto percentual e em valor fixo calculam o preço no servidor", () => {
  assert.equal(
    calculateCouponPrice(
      offer({
        benefit_type: "percentage_discount",
        promotional_price_cents: undefined,
        discount_percent: 20,
      }),
    ),
    3_920,
  );
  assert.equal(
    calculateCouponPrice(
      offer({
        benefit_type: "fixed_discount",
        promotional_price_cents: undefined,
        discount_amount_cents: 1_000,
      }),
    ),
    3_900,
  );
});

test("trial informa dias e preço posterior e respeita o público antigo", () => {
  const coupon = offer({
    benefit_type: "trial",
    promotional_price_cents: undefined,
    trial_days: 7,
    post_trial_price_cents: 4_900,
    eligibility: "former_subscribers",
  });
  assert.equal(calculateCouponPrice(coupon), 0);
  assert.equal(couponPostOfferPrice(coupon), 4_900);
  assert.equal(
    evaluateCouponAvailability(coupon, {
      userId: "new-lead",
      wasSubscriber: false,
      isActiveSubscriber: false,
    }).reason,
    "former_only",
  );
  assert.equal(
    evaluateCouponAvailability(coupon, {
      userId: "former-lead",
      wasSubscriber: true,
      isActiveSubscriber: false,
    }).available,
    true,
  );
});
