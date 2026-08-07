import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { BRAZIL_STATES, type BrazilStateCode } from "@/lib/profile-visibility";

const VALID_STATES = new Set<string>(BRAZIL_STATES.map(([code]) => code));

function normalizeBrazilStateCode(value: unknown): BrazilStateCode | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return VALID_STATES.has(code) ? (code as BrazilStateCode) : null;
}

export const getViewerBrazilState = createServerFn({ method: "GET" }).handler(async () => {
  const request = getRequest() as
    | (Request & {
        cf?: {
          country?: string;
          regionCode?: string;
          region?: string;
        };
      })
    | undefined;
  const headers = request?.headers;
  const country =
    request?.cf?.country ??
    headers?.get("cf-ipcountry") ??
    headers?.get("x-vercel-ip-country") ??
    null;
  if (country && country.toUpperCase() !== "BR") {
    return { stateCode: null, source: "outside_brazil" as const };
  }

  const stateCode =
    normalizeBrazilStateCode(request?.cf?.regionCode) ??
    normalizeBrazilStateCode(headers?.get("cf-region-code")) ??
    normalizeBrazilStateCode(headers?.get("x-vercel-ip-country-region")) ??
    normalizeBrazilStateCode(headers?.get("x-region-code"));

  return {
    stateCode,
    source: stateCode ? ("ip" as const) : ("unavailable" as const),
  };
});
