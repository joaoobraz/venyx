import { createServerFn } from "@tanstack/react-start";

const BASE_URL = "https://nexuspag.com";

// URL pública estável do projeto (Lovable). Ajuste para custom domain quando configurar.
const PROJECT_ID = "59549983-d8c7-43dd-bb65-ffb37fd041ca";
function getWebhookUrl(): string {
  const envUrl = process.env.PUBLIC_WEBHOOK_URL;
  if (envUrl) return envUrl;
  return `https://project--${PROJECT_ID}.lovable.app/api/public/nexuspag-webhook`;
}

function getApiKey(): string {
  const key = process.env.NEXUSPAG_API_KEY;
  if (!key) throw new Error("NEXUSPAG_API_KEY não configurada");
  return key;
}

export const createPixCharge = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      amount: number;
      description?: string;
      external_id?: string;
      expiration_seconds?: number;
    }) => input,
  )
  .handler(async ({ data }) => {
    const body = {
      amount: data.amount,
      description: data.description ?? "Teste NexusPag",
      external_id: data.external_id ?? `test-${Date.now()}`,
      expiration_seconds: data.expiration_seconds ?? 1800,
      webhook_url: getWebhookUrl(),
    };

    const res = await fetch(`${BASE_URL}/api/pix/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": getApiKey(),
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }

    if (!res.ok) {
      return { ok: false as const, status: res.status, error: json };
    }
    return { ok: true as const, data: json };
  });

export const getPixStatus = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const res = await fetch(
      `${BASE_URL}/api/pix/${encodeURIComponent(data.id)}`,
      {
        method: "GET",
        headers: { "x-api-key": getApiKey() },
      },
    );
    const text = await res.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
    if (!res.ok) {
      return { ok: false as const, status: res.status, error: json };
    }
    return { ok: true as const, data: json };
  });
