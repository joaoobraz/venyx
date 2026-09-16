import { createMiddleware, createStart } from "@tanstack/react-start";
import { setResponseHeaders } from "@tanstack/react-start/server";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

/**
 * Headers globais de segurança aplicados a TODAS as respostas SSR.
 * Plataforma adulta: CSP restritivo é obrigatório para mitigar XSS.
 */
// connect-src fechado no Supabase: em caso de XSS, nada pode ser exfiltrado
// para um host arbitrário. Cai para "https:" só se a URL não estiver definida.
const supabaseOrigin = (() => {
  try {
    return new URL(import.meta.env.VITE_SUPABASE_URL as string).origin;
  } catch {
    return "";
  }
})();
const connectSrc = supabaseOrigin
  ? `connect-src 'self' ${supabaseOrigin} ${supabaseOrigin.replace(/^https:/, "wss:")} https://challenges.cloudflare.com`
  : "connect-src 'self' https: wss:";

const securityHeadersMiddleware = createMiddleware().server(async ({ next }) => {
  const cspNonce = crypto.randomUUID().replaceAll("-", "");
  const headers = {
    "x-frame-options": "DENY",
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
    "strict-transport-security":
      "max-age=31536000; includeSubDomains; preload",
    // CSP permite imagens/mídia externas porque o Storage usa URLs assinadas.
    "content-security-policy": [
      "default-src 'self'",
      `script-src 'self' 'nonce-${cspNonce}' 'sha256-szfWHYoOn5tAdFFisCc0Q4JfDbV5o6wkpU8XsQTSdjg=' https://challenges.cloudflare.com`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob: https:",
      connectSrc,
      "object-src 'none'",
      "frame-src https://challenges.cloudflare.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  };
  setResponseHeaders(
    headers as unknown as Parameters<typeof setResponseHeaders>[0],
  );
  return next({ context: { cspNonce } });
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [securityHeadersMiddleware],
}));
