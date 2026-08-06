import assert from "node:assert/strict";
import test from "node:test";
import {
  DEMO_ADMIN_DIRECTORY,
  filterAdminDirectory,
  isKycOperational,
  resolveAdminAccountStatus,
  resolveAdminKycStatus,
} from "../src/lib/demo-admin-directory.ts";

test("cada KYC pertence a um único cadastro de usuário", () => {
  const userIds = DEMO_ADMIN_DIRECTORY.map((user) => user.id);
  const kycIds = DEMO_ADMIN_DIRECTORY.flatMap((user) => (user.kycId ? [user.kycId] : []));

  assert.equal(new Set(userIds).size, userIds.length);
  assert.equal(new Set(kycIds).size, kycIds.length);
});

test("a fila demonstra todos os estados operacionais solicitados", () => {
  const statuses = new Set(DEMO_ADMIN_DIRECTORY.map((user) => user.defaultKycStatus));
  for (const status of [
    "pending",
    "in_review",
    "approved",
    "rejected",
    "invalid_document",
    "selfie_pending",
    "reverification",
    "mismatch",
  ]) {
    assert.equal(statuses.has(status as never), true, status);
  }
});

test("busca e filtros usam o mesmo cadastro exibido em Usuários e KYC", () => {
  const result = filterAdminDirectory(DEMO_ADMIN_DIRECTORY, {
    search: "marina.azevedo",
    accountType: "creator",
    accountStatus: "all",
    kycStatus: "mismatch",
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].username, "marina");
  assert.equal(result[0].kycId, "kyc-2");
});

test("decisões administrativas atualizam o status resolvido do mesmo usuário", () => {
  const marina = DEMO_ADMIN_DIRECTORY.find((user) => user.username === "marina");
  assert.ok(marina);

  assert.equal(resolveAdminAccountStatus(marina, "suspended"), "suspended");
  assert.equal(resolveAdminKycStatus(marina, "approved"), "approved");
});

test("a fila operacional exclui somente resultados finais e KYC não exigido", () => {
  assert.equal(isKycOperational("pending"), true);
  assert.equal(isKycOperational("mismatch"), true);
  assert.equal(isKycOperational("approved"), false);
  assert.equal(isKycOperational("rejected"), false);
  assert.equal(isKycOperational("not_required"), false);
});
