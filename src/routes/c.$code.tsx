import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/c/$code")({
  component: CouponRedirect,
});

function CouponRedirect() {
  const { code } = Route.useParams();
  const nav = useNavigate();

  useEffect(() => {
    (async () => {
      document.cookie = `venyx_coupon=${encodeURIComponent(code)}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax; Secure`;

      const { data } = await supabase
        .from("subscription_coupons")
        .select("creator_id, is_active, uses_count, max_uses")
        .eq("code", code)
        .maybeSingle();

      if (!data || !(data as { is_active: boolean }).is_active) {
        toast.error("Cupom inválido ou expirado");
        nav({ to: "/" });
        return;
      }

      const c = data as { creator_id: string; uses_count: number; max_uses: number };
      if (c.uses_count >= c.max_uses) {
        toast.error("Cupom esgotado");
        nav({ to: "/" });
        return;
      }

      const { data: prof } = await supabase
        .from("profiles")
        .select("username")
        .eq("user_id", c.creator_id)
        .maybeSingle();

      toast.success("Cupom aplicado! Confirme a assinatura.");
      if (prof) {
        nav({ to: "/profile/$username", params: { username: (prof as { username: string }).username } });
      } else {
        nav({ to: "/" });
      }
    })();
  }, [code, nav]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}
