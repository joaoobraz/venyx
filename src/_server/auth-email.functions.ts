import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { clientIpKey, tryRateLimit } from "@/_server/rate-limit.server";
import { findUserIdByEmail, setUserLocale } from "@/_server/auth-admin.server";

const ALLOWED_ORIGINS = new Set([
  "https://fanlira.com.br",
  "https://www.fanlira.com.br",
  "http://localhost:8080",
  "http://localhost:5173",
]);

const RESET_PATH: Record<"pt-BR" | "en" | "es", string> = {
  "pt-BR": "/recuperar-senha",
  en: "/reset-password",
  es: "/recuperar-contrasena",
};

const schema = z.object({
  email: z.string().trim().email().max(254),
  locale: z.enum(["pt-BR", "en", "es"]),
});

/**
 * Redefinição de senha pelo servidor: grava o idioma que a pessoa está usando
 * AGORA nos metadados (mesmo deslogada) e só então dispara o e-mail, que sai
 * nesse idioma. Resposta sempre genérica (não revela se o e-mail existe).
 * Sem captcha aqui (o service_role dispensa), então o freio é o rate limit
 * por IP e por e-mail.
 */
export const requestPasswordReset = createServerFn({ method: "POST" })
  .validator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase();
    const emailHash = createHash("sha256").update(email).digest("hex").slice(0, 32);
    const request = getRequest();
    const ip = clientIpKey(request);

    const [ipOk, emailOk] = await Promise.all([
      tryRateLimit(`pwreset:ip:${ip}`, 10, 60 * 60),
      tryRateLimit(`pwreset:email:${emailHash}`, 3, 60 * 60),
    ]);
    if (!ipOk || !emailOk) {
      return {
        ok: false as const,
        error: "Muitos pedidos em pouco tempo. Aguarde uma hora e tente novamente.",
      };
    }

    const origin = request?.headers.get("origin") ?? "";
    const base = ALLOWED_ORIGINS.has(origin) ? origin : "https://fanlira.com.br";
    const redirectTo = `${base}${RESET_PATH[data.locale] ?? "/reset-password"}`;

    const userId = await findUserIdByEmail(email);
    if (userId) {
      await setUserLocale(userId, data.locale);
      const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) console.error("[auth-email.reset]", error.message);
    }
    // Mesmo retorno com ou sem conta: evita enumeração de e-mails.
    return { ok: true as const };
  });
