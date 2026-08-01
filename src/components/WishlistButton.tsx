import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { toggleWishlist, getMyWishlistIds } from "@/_server/wishlist.functions";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export function WishlistButton({
  targetType,
  targetId,
  variant = "default",
  size = "sm",
  label = "Salvar",
}: {
  targetType: "creator" | "post";
  targetId: string;
  variant?: "default" | "icon";
  size?: "sm" | "default";
  label?: string;
}) {
  const { user, session } = useAuth();
  const { tr } = useI18n();
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const toggleFn = useServerFn(toggleWishlist);
  const listFn = useServerFn(getMyWishlistIds);

  useEffect(() => {
    if (!user || !session?.access_token) return;
    listFn({ headers: { Authorization: `Bearer ${session.access_token}` } }).then((res) => {
      setActive(res.items.some((i) => i.target_type === targetType && i.target_id === targetId));
    }).catch(() => {});
  }, [user, session?.access_token, targetType, targetId, listFn]);

  const onClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user || !session?.access_token) {
      toast.error(tr("Faça login para salvar", "Sign in to save"));
      return;
    }
    setBusy(true);
    try {
      const res = await toggleFn({
        data: { targetType, targetId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      setActive(res.added);
      toast.success(
        res.added
          ? tr("Adicionado aos favoritos 💕", "Added to favorites 💕")
          : tr("Removido dos favoritos", "Removed from favorites"),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusy(false);
    }
  };

  if (variant === "icon") {
    return (
      <button
        onClick={onClick}
        disabled={busy}
        title={
          active
            ? tr("Remover dos favoritos", "Remove from favorites")
            : tr("Adicionar aos favoritos", "Add to favorites")
        }
        className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${
          active
            ? "border-accent bg-accent/15 text-accent"
            : "border-border bg-card/80 text-muted-foreground hover:border-accent/50 hover:text-accent"
        }`}
      >
        <Heart className={`h-4 w-4 ${active ? "fill-current" : ""}`} />
      </button>
    );
  }

  return (
    <Button
      onClick={onClick}
      disabled={busy}
      size={size}
      variant={active ? "default" : "outline"}
      className={active ? "bg-accent text-accent-foreground hover:bg-accent/90" : ""}
    >
      <Heart className={`mr-1.5 h-4 w-4 ${active ? "fill-current" : ""}`} />
      {active ? tr("Salvo", "Saved") : label === "Salvar" ? tr("Salvar", "Save") : label}
    </Button>
  );
}
