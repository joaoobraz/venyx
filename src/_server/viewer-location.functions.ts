import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { normalizeBrazilState, type BrazilStateCode } from "@/lib/profile-visibility";

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
    normalizeBrazilState(request?.cf?.regionCode) ??
    normalizeBrazilState(request?.cf?.region) ??
    normalizeBrazilState(headers?.get("cf-region-code")) ??
    normalizeBrazilState(headers?.get("cf-region")) ??
    normalizeBrazilState(headers?.get("x-vercel-ip-country-region")) ??
    normalizeBrazilState(headers?.get("x-region-code")) ??
    normalizeBrazilState(headers?.get("x-region"));

  return {
    stateCode,
    source: stateCode ? ("ip" as const) : ("unavailable" as const),
  };
});
