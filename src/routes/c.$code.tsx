import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { DEMO_MODE } from "@/lib/demo-creators";
import { readDemoOperations } from "@/lib/demo-operations";
import { couponRemainingSlots, isCouponExpired } from "@/lib/coupon-offers";

export const Route = createFileRoute("/c/$code")({
  component: CouponRedirect,
});

function CouponRedirect() {
  const { code } = Route.useParams();
  const nav = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    (async () => {
      const normalizedCode = code.trim().toUpperCase();
      const secure = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `venyx_coupon=${encodeURIComponent(normalizedCode)}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax${secure}`;

      if (DEMO_MODE) {
        const coupon = readDemoOperations(user?.id ?? "anonymous-coupon-preview").coupons.find(
          (item) => item.code === normalizedCode,
        );
        const available =
          coupon && coupon.active && !isCouponExpired(coupon) && couponRemainingSlots(coupon) !== 0;

        if (!available) {
          document.cookie = `venyx_coupon=; path=/; max-age=0; SameSite=Lax${secure}`;
          toast.info(
            coupon
              ? "A promoção terminou. O perfil foi aberto com o valor normal."
              : "Oferta não encontrada. O perfil foi aberto com o valor normal.",
          );
          nav({ to: "/profile/$username", params: { username: "aline" }, search: {} });
          return;
        }

        toast.success("Oferta aplicada! Confira o valor antes de assinar.");
        nav({
          to: "/profile/$username",
          params: { username: "aline" },
          search: { coupon: normalizedCode },
        });
        return;
      }

      const { data } = await supabase
        .from("subscription_coupons")
        .select("creator_id, is_active, uses_count, max_uses, expires_at")
        .eq("code", normalizedCode)
        .maybeSingle();

      if (
        !data ||
        !(data as { is_active: boolean }).is_active ||
        ((data as { expires_at: string | null }).expires_at !== null &&
          new Date((data as { expires_at: string }).expires_at).getTime() <= Date.now())
      ) {
        toast.error("Cupom inválido ou expirado");
        nav({ to: "/" });
        return;
      }

      const c = data as { creator_id: string; uses_count: number; max_uses: number };
      const { data: prof } = await supabase
        .from("profiles")
        .select("username")
        .eq("user_id", c.creator_id)
        .maybeSingle();

      if (c.max_uses !== 0 && c.uses_count >= c.max_uses) {
        document.cookie = `venyx_coupon=; path=/; max-age=0; SameSite=Lax${secure}`;
        toast.info("A promoção terminou. O perfil foi aberto com o valor normal.");
      } else {
        toast.success("Cupom aplicado! Confirme a assinatura.");
      }
      if (prof) {
        nav({
          to: "/profile/$username",
          params: { username: (prof as { username: string }).username },
        });
      } else {
        nav({ to: "/" });
      }
    })();
  }, [code, nav, user]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}
