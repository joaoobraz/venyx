import { getRequest } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Rate limit por chave, contado no banco (public.consume_rate_limit, só service role).
 * Use chaves como `charge:<userId>`, `verify:ip:<ip>`, `search:ip:<ip>`.
 */

const DEFAULT_MESSAGE = "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.";

async function consume(key: string, limit: number, windowSeconds: number): Promise<boolean | null> {
  const { data, error } = await supabaseAdmin.rpc("consume_rate_limit", {
    _key: key,
    _limit: limit,
    _window_seconds: windowSeconds,
  });
  if (error) {
    console.error("[rate-limit] indisponível", error.code ?? error.message);
    return null;
  }
  return data === true;
}

/** Falha fechada: se o contador estiver indisponível, a ação é recusada. */
export async function assertRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  message: string = DEFAULT_MESSAGE,
): Promise<void> {
  const allowed = await consume(key, limit, windowSeconds);
  if (allowed === null) {
    throw new Error("Serviço temporariamente indisponível. Tente novamente em instantes.");
  }
  if (!allowed) throw new Error(message);
}

/** Falha aberta (para ações de baixo risco, como busca): indisponível = permite. */
export async function tryRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const allowed = await consume(key, limit, windowSeconds);
  return allowed !== false;
}

function firstForwarded(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  return first ? first : null;
}

/** IP do cliente atrás do Cloudflare; "unknown" fora de um request. */
export function clientIpKey(request?: Request): string {
  let req: Request | null = request ?? null;
  if (!req) {
    try {
      req = getRequest();
    } catch {
      req = null;
    }
  }
  if (!req) return "unknown";
  const headers = req.headers;
  const ip =
    headers.get("cf-connecting-ip") ||
    headers.get("x-real-ip") ||
    firstForwarded(headers.get("x-forwarded-for"));
  return (ip ?? "unknown").slice(0, 64);
}
