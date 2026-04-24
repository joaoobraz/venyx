import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/r/$code")({
  component: ReferralRedirect,
});

function ReferralRedirect() {
  const { code } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    (async () => {
      // grava cookie de afiliado por 30 dias
      document.cookie = `venyx_ref=${encodeURIComponent(code)}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax; Secure`;

      // resolve o ambassador_id
      const { data: aff } = await supabase
        .from("affiliate_codes")
        .select("user_id, total_clicks")
        .eq("code", code)
        .maybeSingle();

      if (aff) {
        await supabase
          .from("affiliate_codes")
          .update({ total_clicks: (aff as { total_clicks: number }).total_clicks + 1 })
          .eq("code", code);

        // se já logado, registra a referência (1ª vez)
        if (user) {
          await supabase
            .from("affiliate_referrals")
            .insert({
              code,
              ambassador_id: (aff as { user_id: string }).user_id,
              referred_user_id: user.id,
            })
            .then(() => {
              /* ignora duplicatas */
            });
        }
      }

      nav({ to: "/" });
    })();
  }, [code, user, nav]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}
