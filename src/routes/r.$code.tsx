import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { registerAffiliateReferralServer } from "@/_server/affiliate.functions";

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

      // se já logado, registra a referência via servidor (valida código + ambassador)
      if (user) {
        try {
          await registerAffiliateReferralServer({ data: { code } });
        } catch {
          /* ignora */
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
