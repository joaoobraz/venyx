import { createServerFn } from "@tanstack/react-start";

const BASE_URL = "https://nexuspag.com";

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
