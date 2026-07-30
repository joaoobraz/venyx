import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Sparkles, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { upsertOffer, deleteOffer } from "@/_server/upsells.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/creator/upsells")({
  component: UpsellsPage,
});

interface Offer {
  id: string;
  kind: "order_bump" | "post_purchase_upsell";
  title: string;
  description: string | null;
  price_cents: number;
  media_post_id: string | null;
  is_active: boolean;
  position: number;
}

function UpsellsPage() {
  const { user, isCreator, loading } = useAuth();
  const nav = useNavigate();
  const upsertFn = useServerFn(upsertOffer);
  const deleteFn = useServerFn(deleteOffer);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [editing, setEditing] = useState<Partial<Offer> | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) nav({ to: "/login" });
    else if (!isCreator) nav({ to: "/become-creator" });
  }, [user, isCreator, loading, nav]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("upsell_offers")
      .select("*")
      .eq("creator_id", user.id)
      .order("kind")
      .order("position");
    setOffers((data as Offer[]) ?? []);
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  if (!user || !isCreator) return null;

  const save = async () => {
    if (!editing || !editing.title || !editing.price_cents || !editing.kind) {
      toast.error("Preencha título, tipo e preço");
      return;
    }
    setBusy(true);
    try {
      await upsertFn({
        data: {
          id: editing.id ?? null,
          kind: editing.kind,
          title: editing.title.trim(),
          description: editing.description?.trim() ?? null,
          price_cents: editing.price_cents,
          media_post_id: editing.media_post_id ?? null,
          is_active: editing.is_active ?? true,
          position: editing.position ?? 0,
        },
      });
      toast.success("Oferta salva!");
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Remover esta oferta?")) return;
    try {
      await deleteFn({ data: { id } });
      toast.success("Removida");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  const bumps = offers.filter((o) => o.kind === "order_bump");
  const upsells = offers.filter((o) => o.kind === "post_purchase_upsell");

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Order Bumps & Upsells</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Aumente o ticket médio: ofereça extras no checkout (até 3 bumps) e uma oferta única logo
            após a assinatura (1 upsell). Toda entrega precisa ficar dentro da plataforma — links
            externos, redes sociais, telefone e e-mail são bloqueados.
          </p>
        </div>

        <Section
          icon={<ShoppingCart className="h-4 w-4 text-accent" />}
          title="Order Bumps (até 3)"
          description="Aparecem como checkboxes no checkout da assinatura. O cliente marca e o valor entra no mesmo Pix."
          offers={bumps}
          max={3}
          onNew={() => setEditing({ kind: "order_bump", is_active: true, position: bumps.length })}
          onEdit={setEditing}
          onDelete={remove}
        />

        <Section
          icon={<Sparkles className="h-4 w-4 text-accent" />}
          title="One-Click Upsell (1 ativo)"
          description="Mostrado em tela cheia logo após a assinatura ser confirmada. 1 clique gera novo Pix."
          offers={upsells}
          max={1}
          onNew={() => setEditing({ kind: "post_purchase_upsell", is_active: true, position: 0 })}
          onEdit={setEditing}
          onDelete={remove}
        />
      </div>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing?.id ? "Editar oferta" : "Nova oferta"}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Título (máx. 60)</label>
                <Input
                  value={editing.title ?? ""}
                  maxLength={60}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  placeholder="Ex: Pack 10 fotos exclusivas"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Descrição (opcional, máx. 280)</label>
                <Textarea
                  value={editing.description ?? ""}
                  maxLength={280}
                  rows={3}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  placeholder="Detalhe o que o cliente recebe — sem links, telefone ou redes sociais."
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Preço (R$)</label>
                <Input
                  type="number"
                  step="0.50"
                  min="1"
                  value={editing.price_cents ? (editing.price_cents / 100).toFixed(2) : ""}
                  onChange={(e) =>
                    setEditing({ ...editing, price_cents: Math.round(parseFloat(e.target.value || "0") * 100) })
                  }
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">
                  Post de entrega (opcional — UUID de um post seu PPV)
                </label>
                <Input
                  value={editing.media_post_id ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, media_post_id: e.target.value || null })
                  }
                  placeholder="Ao pagar, libera esse post automaticamente"
                />
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted p-3">
                <span className="text-sm">Ativa</span>
                <Switch
                  checked={editing.is_active ?? true}
                  onCheckedChange={(v) => setEditing({ ...editing, is_active: v })}
                />
              </div>
              <Button
                onClick={save}
                disabled={busy}
                className="w-full bg-primary text-primary-foreground"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Section({
  icon,
  title,
  description,
  offers,
  max,
  onNew,
  onEdit,
  onDelete,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  offers: Offer[];
  max: number;
  onNew: () => void;
  onEdit: (o: Offer) => void;
  onDelete: (id: string) => void;
}) {
  const activeCount = offers.filter((o) => o.is_active).length;
  return (
    <div className="space-y-2 rounded-2xl bg-card p-5">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-bold text-foreground">{title}</h2>
        <span className="ml-auto text-[10px] font-semibold text-muted-foreground">
          {activeCount}/{max} ativas
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>

      <div className="space-y-2 pt-2">
        {offers.length === 0 && (
          <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            Nenhuma oferta ainda.
          </p>
        )}
        {offers.map((o) => (
          <div key={o.id} className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground">{o.title}</span>
                {!o.is_active && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    inativa
                  </span>
                )}
              </div>
              {o.description && (
                <p className="text-xs text-muted-foreground line-clamp-1">{o.description}</p>
              )}
              <div className="mt-0.5 text-xs font-semibold text-accent">
                R$ {(o.price_cents / 100).toFixed(2)}
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => onEdit(o)}>
              Editar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onDelete(o.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>

      <Button
        onClick={onNew}
        disabled={activeCount >= max}
        size="sm"
        variant="outline"
        className="w-full"
      >
        <Plus className="mr-1 h-4 w-4" /> Nova oferta
      </Button>
    </div>
  );
}
