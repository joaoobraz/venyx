import test from "node:test";
import assert from "node:assert/strict";
import { getDemoGiftList, isGiftItemPurchasable } from "../src/lib/demo-gifts.ts";
import {
  applyDemoGiftProductPurchase,
  createDemoOperationsSeed,
} from "../src/lib/demo-operations.ts";
import { classifyProductImageOrientation } from "../src/lib/product-image.ts";

test("oferece produtos base completos sem categoria simbólica pública", () => {
  const list = getDemoGiftList("aline");
  assert.ok(list);
  assert.ok(list.items.length >= 4);
  for (const item of list.items) {
    assert.ok(item.title);
    assert.ok(item.description);
    assert.ok(item.value_cents >= 100);
    assert.ok(["available", "on_request"].includes(item.availability));
    assert.equal("category" in item, false);
  }
});

test("oculta produtos desativados e produtos sem estoque", () => {
  const item = createDemoOperationsSeed().giftItems[0];
  assert.equal(isGiftItemPurchasable(item), true);
  assert.equal(isGiftItemPurchasable({ ...item, active: false }), false);
  assert.equal(isGiftItemPurchasable({ ...item, track_stock: true, stock_quantity: 0 }), false);
});

test("usa o preço atual e reduz o estoque na compra confirmada", () => {
  const current = {
    ...createDemoOperationsSeed().giftItems[2],
    stock_quantity: 2,
  };
  const purchased = applyDemoGiftProductPurchase(current, current.value_cents);
  assert.equal(purchased.stock_quantity, 1);
  assert.equal(purchased.received_count, current.received_count + 1);
  assert.equal(purchased.received_cents, current.received_cents + current.value_cents);
  assert.throws(
    () => applyDemoGiftProductPurchase(current, current.value_cents - 100),
    /valor deste produto foi atualizado/i,
  );
});

test("reconhece automaticamente fotos verticais de celular", () => {
  assert.equal(classifyProductImageOrientation(1080, 1920), "portrait");
  assert.equal(classifyProductImageOrientation(1080, 1080), "square");
  assert.equal(classifyProductImageOrientation(1920, 1080), "landscape");
  assert.equal(classifyProductImageOrientation(0, 0), "portrait");
});
