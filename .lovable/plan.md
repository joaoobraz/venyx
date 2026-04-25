## TL;DR
O site **está publicado e público**, mas a varredura de segurança encontrou **3 falhas críticas** que precisam ser resolvidas **antes** de divulgar para o público — caso contrário, há risco de bypass de paywall, escalonamento de privilégios e abuso da API de pagamento.

---

## 🔴 Bloqueadores (resolver ANTES de divulgar)

### 1. PIX server functions sem autenticação ⚠️ CRÍTICO
**Onde:** `src/server/nexuspag.functions.ts` — `createPixCharge` e `getPixStatus`
**Problema:** Qualquer pessoa na internet pode chamar essas funções e gerar cobranças PIX reais usando sua `NEXUSPAG_API_KEY`. A "proteção" no `test-pix.tsx` é só client-side (fácil de burlar).
**Risco:** Esgotar quota da API, gerar cobranças fraudulentas, custo financeiro real.
**Fix:** Adicionar `requireSupabaseAuth` middleware + checagem server-side de role (seller/admin), igual ao `admin.functions.ts`. Substituir `inputValidator` identity por schema Zod (`amount.positive().max(100000)`, etc.).

### 2. Mídia paga acessível sem pagar ⚠️ CRÍTICO
**Onde:** Tabela `post_media` + bucket `posts` no storage
**Problema:** A política RLS de `post_media` deixa qualquer um (até anônimo) ler `storage_path` de posts PPV/assinantes. Com a URL na mão, o conteúdo pago é baixável direto.
**Fix:**
- Reescrever a policy SELECT de `post_media` espelhando exatamente `can_view_post()`.
- Adicionar policies de SELECT no bucket `posts` que validam: dono OR assinatura ativa OR `ppv_unlocks`.
- Mesmo problema no bucket `stories` — adicionar policy verificando assinatura.

### 3. Possível escalonamento de privilégio em `user_roles`
**Onde:** Tabela `user_roles`
**Problema:** Verificar se há algum caminho (anon/authenticated) que permita um user inserir uma linha com `role='admin'` na própria conta. Se houver, pwn total via `has_role()`.
**Fix:** Confirmar que **só** admins podem INSERT/UPDATE/DELETE em `user_roles`. Adicionar policy explícita `INSERT … WITH CHECK (has_role(auth.uid(),'admin'))` se faltar.

---

## 🟡 Importantes (recomendado antes do lançamento)

### 4. CSP fraca permite XSS
`src/start.ts` tem `script-src 'unsafe-inline' 'unsafe-eval'`. Em plataforma adulta com upload de mídia e chat, XSS pode roubar sessão. Remover essas duas diretivas e usar nonce no único inline script (tema, em `__root.tsx`).

### 5. Grafo de follows 100% público
Qualquer anônimo pode listar todos os pares (seguidor, seguido) do site. Em plataforma adulta isso é problema de privacidade. Restringir SELECT em `follows` a usuários autenticados.

### 6. Withdrawal requests sem INSERT policy
Criadores não conseguem solicitar saque via RLS. Confirmar se vai por server function (com `requireSupabaseAuth`) — caso sim, ok. Senão, adicionar policy de INSERT.

### 7. Extensão no schema `public`
Mover extensão para schema dedicado (ex: `extensions`).

---

## 🟢 Polimento pré-lançamento (qualidade/operação)

### 8. Conformidade legal (essencial em plataforma adulta)
- **Verificar idade 18+** (já existe `AgeGateModal`, mas confirmar persistência e bloqueio real).
- **Termos de uso** e **Política de privacidade** revisados (rotas existem: `/terms`, `/privacy`).
- **DMCA** com formulário funcional (já há `/dmca` e `admin.dmca`).
- **Política de cookies** + banner de consentimento (LGPD/GDPR).
- **2257 compliance** (registros de idade dos modelos) se aplicável ao seu mercado.

### 9. Email transacional com domínio próprio
Hoje os emails de auth saem do remetente padrão Lovable. Para um app comercial, configure um domínio de envio (Reset de senha, confirmação, recibos de PIX) — vai pra spam menos e parece mais profissional.

### 10. Domínio próprio + SSL
Site está em `private-pleasures-portal.lovable.app`. Conectar domínio próprio (ex: `seudominio.com`) em **Project Settings → Domains**.

### 11. Monitoramento
- Configurar alertas em pagamentos suspeitos.
- Revisar a tabela de auditoria admin que criamos.
- Definir backup/exportação do banco.

### 12. Capa de SEO/Open Graph
Verificar se cada rota pública (perfis, posts) tem `og:image` próprio para preview correto em redes sociais.

---

## Minha recomendação de ordem
1. **Hoje, sem falta:** itens 1, 2, 3 (os críticos vermelhos).
2. **Antes de divulgar:** 4, 5, 8 (XSS, privacidade, conformidade).
3. **Primeira semana de operação:** 9, 10, 11, 12.

Posso começar pelos críticos (1, 2, 3) agora? Faço numa única passada — auth nas funções PIX, RLS no `post_media` + buckets, e travamento do `user_roles`.