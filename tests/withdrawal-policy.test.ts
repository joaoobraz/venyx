import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  ADDITIONAL_WITHDRAWAL_FEE_CENTS,
  DAILY_WITHDRAWAL_LIMIT,
  MIN_WITHDRAWAL_CENTS,
  countDailyWithdrawals,
  maximumWithdrawalAmount,
  saoPauloDateKey,
  withdrawalFeeForDailyCount,
} from "../src/lib/withdrawal-policy.ts";

test("first withdrawal of the Sao Paulo day is free", () => {
  assert.equal(withdrawalFeeForDailyCount(0), 0);
  assert.equal(withdrawalFeeForDailyCount(1), ADDITIONAL_WITHDRAWAL_FEE_CENTS);
  assert.equal(withdrawalFeeForDailyCount(4), ADDITIONAL_WITHDRAWAL_FEE_CENTS);
});

test("daily count follows Sao Paulo day and ignores canceled or rejected requests", () => {
  const rows = [
    { created_at: "2026-08-20T02:59:59.000Z", status: "paid" },
    { created_at: "2026-08-20T03:00:00.000Z", status: "pending" },
    { created_at: "2026-08-20T12:00:00.000Z", status: "processing" },
    { created_at: "2026-08-20T13:00:00.000Z", status: "canceled" },
    { created_at: "2026-08-20T14:00:00.000Z", status: "rejected" },
  ];

  assert.equal(saoPauloDateKey(rows[0].created_at), "2026-08-19");
  assert.equal(saoPauloDateKey(rows[1].created_at), "2026-08-20");
  assert.equal(countDailyWithdrawals(rows, "2026-08-20T20:00:00.000Z"), 2);
});

test("withdraw-all reserves the Fanlira fee without going below zero", () => {
  assert.equal(maximumWithdrawalAmount(10_000, 0), 10_000);
  assert.equal(maximumWithdrawalAmount(10_000, 1), 9_700);
  assert.equal(maximumWithdrawalAmount(200, 1), 0);
  assert.equal(MIN_WITHDRAWAL_CENTS, 3_000);
  assert.equal(DAILY_WITHDRAWAL_LIMIT, 5);
});

test("database policy enforces the daily cap, Sao Paulo timezone and fee absorption", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/20260820130000_withdrawal_daily_policy.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /America\/Sao_Paulo/);
  assert.match(sql, /FANLIRA_DAILY_WITHDRAWAL_LIMIT/);
  assert.match(sql, /_daily_count\s*>?=\s*5/);
  assert.match(sql, /_fanlira_fee_cents\s*:=\s*300/);
  assert.match(sql, /gateway_net_amount_cents/);
  assert.match(sql, /pg_advisory_xact_lock/);
});
