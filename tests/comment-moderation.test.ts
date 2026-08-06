import assert from "node:assert/strict";
import test from "node:test";
import { evaluateCommentModerationPolicy } from "../src/lib/comment-moderation-policy.ts";

const base = {
  manualApproval: false,
  blockedKeywords: ["telegram", "pix por fora"],
  blockedUserIds: ["blocked-user"],
  userId: "active-user",
  body: "Que produção incrível!",
};

test("publica imediatamente quando a aprovação manual está desativada", () => {
  assert.deepEqual(evaluateCommentModerationPolicy(base), {
    accepted: true,
    status: "published",
  });
});
test("envia o comentário para a fila quando a aprovação manual está ativa", () => {
  assert.deepEqual(
    evaluateCommentModerationPolicy({ ...base, manualApproval: true }),
    { accepted: true, status: "pending" },
  );
});

test("bloqueia palavras e expressões sem diferenciar maiúsculas", () => {
  assert.deepEqual(
    evaluateCommentModerationPolicy({ ...base, body: "Me chama no TELEGRAM" }),
    { accepted: false, status: "blocked_keyword", blockedKeyword: "telegram" },
  );
});

test("impede novos comentários de um usuário bloqueado", () => {
  assert.deepEqual(
    evaluateCommentModerationPolicy({ ...base, userId: "blocked-user" }),
    { accepted: false, status: "blocked_user" },
  );
});
