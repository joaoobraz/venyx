import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function isAdultVerified(userId: string): Promise<boolean> {
  const [{ data: identityVerified, error: identityError }, { data: creatorKyc }] =
    await Promise.all([
      supabaseAdmin.rpc("is_age_verified", { _user_id: userId }),
      supabaseAdmin
        .from("kyc_requests")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "approved")
        .limit(1)
        .maybeSingle(),
    ]);

  if (identityError) {
    console.error("[access-control] age verification lookup failed", identityError);
  }

  return identityVerified === true || !!creatorKyc;
}

export async function assertAdultVerified(userId: string): Promise<void> {
  if (!(await isAdultVerified(userId))) {
    throw new Response("Confirme sua identidade e idade antes de continuar.", {
      status: 403,
    });
  }
}

export const requireAdultVerification = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    await assertAdultVerified(context.userId);
    return next();
  });

export const requireSupabaseMfa = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const aal = (context.claims as { aal?: string }).aal;
    if (aal !== "aal2") {
      throw new Response("Confirme o código da autenticação em dois fatores.", {
        status: 403,
      });
    }
    return next();
  });
