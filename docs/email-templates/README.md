# Modelos de e-mail do Supabase (pt-BR / en / es)

Cole cada arquivo em **Supabase → Authentication → Emails → Templates**, no modelo
correspondente. O idioma é escolhido pelo campo `locale` gravado na conta pelo
site (`user_metadata.locale`: `pt-BR`, `en` ou `es`). Quem não tem o campo
(contas antigas ou login pelo Google antes da primeira visita) recebe em
português.

| Modelo no Supabase | Arquivo | Assunto sugerido |
|---|---|---|
| Confirm signup | `confirm-signup.html` | `Confirme seu e-mail na Fanlira · Confirm your email` |
| Reset password | `reset-password.html` | `Redefinir sua senha da Fanlira · Reset your password` |
| Magic Link (usado como código 2FA por e-mail) | `magic-link.html` | `Seu código de acesso à Fanlira · Your access code` |
| Change email address | `change-email.html` | `Confirme seu novo e-mail · Confirm your new email` |

Variáveis usadas: `{{ .ConfirmationURL }}` (link), `{{ .Token }}` (código de 6
dígitos), `{{ .Data.locale }}` (idioma), `{{ .Email }}` / `{{ .NewEmail }}`.
