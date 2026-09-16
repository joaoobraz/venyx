import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260819233000_final_security_advisor_hardening.sql",
    import.meta.url,
  ),
  "utf8",
);

test("revoga execução pública de todas as funções SECURITY DEFINER", () => {
  assert.match(migration, /WHERE namespace\.nspname = 'public'[\s\S]+procedure\.prosecdef/);
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated/,
  );
  assert.match(migration, /GRANT EXECUTE ON FUNCTION %s TO service_role/);
});

test("reabre somente os RPCs autenticados exigidos pelo aplicativo", () => {
  for (const signature of [
    "list_feed_posts(uuid, uuid, integer)",
    "list_thread_messages_verified(uuid)",
    "schedule_my_subscription_cancellation(uuid, text)",
    "undo_my_subscription_cancellation(uuid)",
    "set_my_account_paused(boolean)",
    "set_pinned_post(uuid)",
    "claim_loyalty_reward(uuid)",
  ]) {
    assert.ok(migration.includes(`public.${signature}`), `${signature} precisa de grant explícito`);
  }
});

test("impede listagem ampla das imagens públicas de produtos", () => {
  assert.match(
    migration,
    /DROP POLICY IF EXISTS "Imagens de produtos públicas" ON storage\.objects/,
  );
});
