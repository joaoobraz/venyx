import { createHash } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  CURRENT_CREATOR_POLICY_VERSION,
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
} from "@/lib/legal-versions";

function clientIp(request: Request | undefined) {
  const forwarded = request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request?.headers.get("cf-connecting-ip") || request?.headers.get("x-real-ip") || null;
}

function userAgentHash(request: Request | undefined) {
  const value = request?.headers.get("user-agent");
  return value ? createHash("sha256").update(value).digest("hex") : null;
}

const kycSchema = z.object({
  documentType: z.enum(["RG", "CNH", "Passport"]),
  documentFrontPath: z.string().min(3).max(500),
  documentBackPath: z.string().min(3).max(500).nullable(),
  selfiePath: z.string().min(3).max(500),
  acceptedTerms: z.literal(true),
  confirmedAdult: z.literal(true),
  confirmedContentRights: z.literal(true),
});

export const submitCreatorKyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => kycSchema.parse(input))
  .handler(async ({ data, context }) => {
    const request = getRequest();
    const prefix = `${context.userId}/`;
    const paths = [data.documentFrontPath, data.selfiePath, data.documentBackPath].filter(
      (path): path is string => Boolean(path),
    );
    if (paths.some((path) => !path.startsWith(prefix))) {
      throw new Error("Os arquivos enviados não pertencem a esta conta.");
    }

    const { data: kycId, error } = await supabaseAdmin.rpc(
      "submit_creator_kyc_with_consent",
      {
        _user_id: context.userId,
        _document_type: data.documentType,
        _document_front_url: data.documentFrontPath,
        _document_back_url: data.documentBackPath,
        _selfie_url: data.selfiePath,
        _terms_version: CURRENT_TERMS_VERSION,
        _privacy_version: CURRENT_PRIVACY_VERSION,
        _creator_policy_version: CURRENT_CREATOR_POLICY_VERSION,
        _ip_address: clientIp(request),
        _user_agent_hash: userAgentHash(request),
      },
    );
    if (error || !kycId) {
      const message = error?.message ?? "";
      if (message.includes("VENYX_KYC_ALREADY_ACTIVE")) {
        throw new Error("Já existe uma verificação ativa para esta conta.");
      }
      console.error("[creator-onboarding.submitKyc]", error?.code);
      throw new Error("Não foi possível registrar a verificação. Tente novamente.");
    }
    return { ok: true, kycId };
  });

export const acceptCurrentCreatorConsents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        acceptedTerms: z.literal(true),
        confirmedAdult: z.literal(true),
        confirmedContentRights: z.literal(true),
      })
      .parse(input),
  )
  .handler(async ({ context }) => {
    const request = getRequest();
    const { error } = await supabaseAdmin.rpc("record_creator_consents", {
      _user_id: context.userId,
      _terms_version: CURRENT_TERMS_VERSION,
      _privacy_version: CURRENT_PRIVACY_VERSION,
      _creator_policy_version: CURRENT_CREATOR_POLICY_VERSION,
      _ip_address: clientIp(request),
      _user_agent_hash: userAgentHash(request),
      _source: "creator_onboarding",
    });
    if (error) {
      console.error("[creator-onboarding.acceptConsents]", error.code);
      throw new Error("Não foi possível registrar o consentimento.");
    }
    return { ok: true };
  });

export const getCreatorOnboardingStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: role }, { data, error }] = await Promise.all([
      supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", context.userId)
        .eq("role", "creator")
        .maybeSingle(),
      supabaseAdmin.rpc("creator_onboarding_status", { _user_id: context.userId }),
    ]);
    if (error) {
      console.error("[creator-onboarding.status]", error.code);
      throw new Error("Não foi possível carregar as etapas da criadora.");
    }
    const status = Array.isArray(data) ? data[0] : data;
    return {
      isCreator: Boolean(role),
      kycApproved: status?.kyc_approved === true,
      consentComplete: status?.consent_complete === true,
      profileComplete: status?.profile_complete === true,
      priceConfigured: status?.price_configured === true,
      payoutKeyConfigured: status?.payout_key_configured === true,
      firstPostCreated: status?.first_post_created === true,
      monetizationReady: status?.monetization_ready === true,
    };
  });
