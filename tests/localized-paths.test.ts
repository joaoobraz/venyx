import assert from "node:assert/strict";
import test from "node:test";
import { localizedPathname } from "../src/lib/localized-paths.ts";

test("traduz rotas públicas e da criadora para português", () => {
  assert.equal(localizedPathname("/signup", "pt-BR"), "/cadastro");
  assert.equal(localizedPathname("/settings/profile", "pt-BR"), "/configuracoes/perfil");
  assert.equal(localizedPathname("/creator/posts", "pt-BR"), "/criadora/publicacoes");
});

test("traduz rotas dinâmicas sem alterar o parâmetro", () => {
  assert.equal(localizedPathname("/profile/aline", "pt-BR"), "/perfil/aline");
  assert.equal(localizedPathname("/mimos/aline", "en"), "/gifts/aline");
});

test("preserva rotas técnicas e retorna ao inglês quando EN estiver ativo", () => {
  assert.equal(localizedPathname("/cadastro", "en"), "/signup");
  assert.equal(localizedPathname("/admin/users", "pt-BR"), "/administracao/usuarios");
  assert.equal(localizedPathname("/salvo/post-1", "en"), "/saved/post-1");
  assert.equal(localizedPathname("/auth/callback", "pt-BR"), "/auth/callback");
});
