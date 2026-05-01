## Plano final aprovado de aplicação

Confirmado: existem **2 admins** ativos hoje (`5c528358...` e `4ab5bf0d...`). Nenhum passo desta migration mexe na tabela `user_roles`, então ambos continuam admins.

Quando aprovar, executo na ordem abaixo.

---

### Fase 1 — Migration única (C1 + C2 + C3 + A1-parcial + M3)

```sql
-- ============ C1: bucket `posts` — remover policies redundantes ============
-- Mantém apenas as que exigem has_role(creator) para INSERT/UPDATE/DELETE
-- e a policy SELECT com paywall (can_view_post via post_media join).
DROP POLICY IF EXISTS "Posts: criadora upload"            ON storage.objects;
DROP POLICY IF EXISTS "Criadora envia mídia em sua pasta" ON storage.objects;
DROP POLICY IF EXISTS "Posts: criadora delete"            ON storage.objects;
DROP POLICY IF EXISTS "Criadora apaga sua mídia"          ON storage.objects;

-- ============ C2: bucket `chat-media` — paywall real ============
DROP POLICY IF EXISTS "chat media: participants can read" ON storage.objects;
DROP POLICY IF EXISTS "Chat: participante lê"             ON storage.objects;
DROP POLICY IF EXISTS "Sender lê seu chat media"          ON storage.objects;

CREATE POLICY "Chat media: paywall (SELECT)"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-media' AND (
    (auth.uid())::text = (storage.foldername(name))[1]   -- sender sempre vê
    OR EXISTS (
      SELECT 1
      FROM public.chat_messages m
      JOIN public.chat_threads  t ON t.id = m.thread_id
      WHERE m.media_path = storage.objects.name
        AND (t.user_a = auth.uid() OR t.user_b = auth.uid())
        AND (
          m.ppv_price_cents = 0
          OR EXISTS (SELECT 1 FROM public.chat_ppv_unlocks u
                      WHERE u.message_id = m.id AND u.user_id = auth.uid())
        )
        AND (
          NOT m.subscribers_only
          OR EXISTS (
            SELECT 1 FROM public.subscriptions s
            WHERE s.status = 'active'
              AND ((s.creator_id = m.sender_id AND s.subscriber_id = auth.uid())
                OR (s.creator_id = auth.uid()  AND s.subscriber_id = m.sender_id))
          )
        )
    )
  )
);

-- ============ C3: handle_new_user — sem auto-promoção a admin ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE base_username TEXT; final_username TEXT; suffix INT := 0;
BEGIN
  base_username := lower(regexp_replace(
    coalesce(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    '[^a-z0-9_]', '', 'g'));
  IF base_username = '' OR base_username IS NULL THEN
    base_username := 'user' || substr(NEW.id::text, 1, 8);
  END IF;
  final_username := base_username;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    suffix := suffix + 1;
    final_username := base_username || suffix::text;
  END LOOP;
  INSERT INTO public.profiles (user_id, username, display_name)
  VALUES (NEW.id, final_username,
          coalesce(NEW.raw_user_meta_data->>'display_name', final_username));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'subscriber');
  RETURN NEW;
END; $$;

-- ============ A1 (parcial seguro): bloquear leitura anônima de campos internos
REVOKE SELECT (trial_days, trial_days_enabled) ON public.profiles FROM anon;
GRANT  SELECT (trial_days, trial_days_enabled) ON public.profiles TO authenticated;

-- ============ M3: revogar EXECUTE de RPCs SECURITY DEFINER do anon ============
REVOKE EXECUTE ON FUNCTION public.start_creator_trial(uuid)          FROM anon;
REVOKE EXECUTE ON FUNCTION public.validate_coupon(uuid, text)        FROM anon;
REVOKE EXECUTE ON FUNCTION public.mass_dm_campaign_revenue(uuid)     FROM anon;
REVOKE EXECUTE ON FUNCTION public.subscriptions_expiring_in(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_thread_messages(uuid)         FROM anon;
-- Funções de manutenção/cron: somente service-role
REVOKE EXECUTE ON FUNCTION public.expire_due_subscriptions()         FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_stories()          FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_mass_dm_batch(integer)     FROM anon, authenticated;
```

### Fase 2 — Edits de código

| Arquivo | Mudança |
|---|---|
| `src/server/admin.functions.ts` | Em `reviewKycServer`, `updateDmcaReportServer`, `listAdminActionsAudit`: substituir `throw new Error(error.message)` por mensagem genérica + `console.error` interno (A2). |
| `src/server/admin-users.functions.ts` | Mesmo tratamento em `listUsersAdmin` e `updateUserRoleAdmin` (A2). |
| `src/routes/reset-password.tsx` | `sendLink`: sempre toast genérico "Se este e-mail existir, enviamos um link de redefinição" — não vazar erro do Supabase (M1). |
| `supabase/functions/moderate-media/index.ts` | CORS allowlist (M2). |
| `supabase/functions/suggest-caption/index.ts` | CORS allowlist (M2). |
| `supabase/functions/translate-message/index.ts` | CORS allowlist (M2). |

CORS allowlist:
```ts
const ALLOWED = new Set([
  "https://private-pleasures-portal.lovable.app",
  "https://id-preview--59549983-d8c7-43dd-bb65-ffb37fd041ca.lovable.app",
]);
const origin = req.headers.get("origin") ?? "";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED.has(origin) ? origin : "https://private-pleasures-portal.lovable.app",
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
```

### Fase 3 — Redeploy

Redeployar `moderate-media`, `suggest-caption`, `translate-message`.

### Fase 4 — Testes pós-aplicação

1. `supabase--read_query`:
   - `count(*) FROM user_roles WHERE role='admin'` → deve continuar **2**
   - `pg_policies WHERE tablename='objects' AND policyname LIKE '%chat-media%'` → confirma nova política
   - `pg_get_functiondef('handle_new_user'::regproc)` → confirma sem `is_first`
2. `supabase--linter` — checar findings críticas
3. `security--run_security_scan` + `security--get_scan_results`

### Fase 5 — Relatório final

Te entrego: arquivos alterados, SQL aplicada, prova de C1/C2/C3 corrigidos, resultado dos testes, configurações manuais pendentes (Auth: confirm email, leaked password protection, captcha; allowlist CORS quando ligar domínio próprio) e a **proposta da view pública `profiles_public`** que separa vitrine de dados internos (item 4 do seu pedido).

### Garantias de não-quebra

| Fluxo | Status | Justificativa |
|---|---|---|
| Login/cadastro | OK | C3 só remove auto-admin; trigger inalterado |
| Assinatura | OK | Server fns usam service role (RLS bypass) |
| Chat texto | OK | C2 só toca SELECT em storage `chat-media` |
| Chat mídia PPV | **Corrige bug** | Antes liberava sem pagar |
| Upload de post | OK | INSERT já era restrito a creator |
| Webhook NexusPag | OK | Service role |
| Saque | OK | RLS de transactions/withdrawal_requests inalterada |
| Painel admin | OK | 2 admins preservados, lógica inalterada |

### Item 4 — preview da próxima entrega (view `profiles_public`)

Após aplicar tudo isso, na próxima rodada eu proponho:
```sql
CREATE VIEW public.profiles_public AS
SELECT user_id, username, display_name, bio, avatar_url, cover_url,
       is_verified, language, location, subscription_price_cents,
       watermark_position, watermark_opacity
FROM public.profiles;
GRANT SELECT ON public.profiles_public TO anon, authenticated;
REVOKE SELECT ON public.profiles FROM anon;  -- só logado lê tabela "crua"
```
E atualizo `src/lib/posts.ts`, `profile.$username.tsx`, `wishlist.tsx`, `links.$username.tsx` e `explore.tsx` para usarem `profiles_public` quando o leitor é anônimo. Não faço agora porque é refator amplo — entrego como segundo passo após validarmos que a Fase 1–3 não quebrou nada.

---

**Aprove este plano** para eu aplicar tudo via build mode.
