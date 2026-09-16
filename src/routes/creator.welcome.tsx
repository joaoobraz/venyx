import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ChangeEvent } from "react";
import { Loader2, MessageSquareHeart, Paperclip, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { describeError } from "@/lib/error-message";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/creator/welcome")({
  head: () => ({ meta: [{ title: "Boas-vindas automáticas" }] }),
  component: CreatorWelcomePage,
});

type Template = {
  enabled: boolean;
  body: string;
  media_path: string | null;
  mime_type: string | null;
  ppv_price_cents: number;
};

const EMPTY: Template = { enabled: true, body: "", media_path: null, mime_type: null, ppv_price_cents: 0 };
const MEDIA_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

/**
 * Mensagem automática enviada no chat assim que alguém assina. É a maior
 * fonte de venda de PPV nas plataformas grandes: texto de agradecimento +
 * uma mídia paga logo de cara. O envio acontece no servidor, na ativação.
 */
function CreatorWelcomePage() {
  const { tr } = useI18n();
  const { user, isCreator, loading } = useAuth();
  const nav = useNavigate();
  const [tpl, setTpl] = useState<Template>(EMPTY);
  const [exists, setExists] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [priceStr, setPriceStr] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) nav({ to: "/login" });
    else if (!isCreator) nav({ to: "/become-creator" });
  }, [user, isCreator, loading, nav]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("creator_welcome_messages" as never)
      .select("enabled, body, media_path, mime_type, ppv_price_cents")
      .eq("creator_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const row = data as unknown as Template | null;
        if (row) {
          setTpl(row);
          setExists(true);
          setPriceStr(row.ppv_price_cents ? (row.ppv_price_cents / 100).toFixed(2).replace(".", ",") : "");
        }
      });
  }, [user]);

  const pickMedia = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !user) return;
    const ext = MEDIA_TYPES[f.type];
    if (!ext || f.size > 100 * 1024 * 1024) {
      toast.error(
        tr(
          "Envie imagem (JPG, PNG, WebP, GIF) ou vídeo (MP4, MOV, WebM) de até 100 MB.",
          "Upload an image or video up to 100 MB.",
        ),
      );
      return;
    }
    setUploading(true);
    try {
      const path = `${user.id}/welcome/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("chat-media")
        .upload(path, f, { contentType: f.type, upsert: false });
      if (error) throw error;
      setTpl((t) => ({ ...t, media_path: path, mime_type: f.type }));
      toast.success(tr("Mídia anexada. Salve para aplicar.", "Media attached. Save to apply."));
    } catch (err) {
      toast.error(describeError(err, tr));
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!user) return;
    const price = priceStr.trim() ? Math.round(Number.parseFloat(priceStr.replace(",", ".")) * 100) : 0;
    if (Number.isNaN(price) || price < 0) {
      toast.error(tr("Preço inválido.", "Invalid price."));
      return;
    }
    if (price > 0 && price < 100) {
      toast.error(tr("Preço mínimo do PPV: R$ 1,00.", "Minimum PPV price: R$ 1.00."));
      return;
    }
    if (price > 0 && !tpl.media_path) {
      toast.error(tr("Para cobrar, anexe uma mídia.", "Attach a media file to charge for it."));
      return;
    }
    if (!tpl.body.trim() && !tpl.media_path) {
      toast.error(tr("Escreva um texto ou anexe uma mídia.", "Write a message or attach media."));
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("creator_welcome_messages" as never).upsert(
        {
          creator_id: user.id,
          enabled: tpl.enabled,
          body: tpl.body.trim(),
          media_path: tpl.media_path,
          mime_type: tpl.media_path ? tpl.mime_type : null,
          ppv_price_cents: tpl.media_path ? price : 0,
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: "creator_id" },
      );
      if (error) throw error;
      setExists(true);
      toast.success(
        tpl.enabled
          ? tr(
              "Boas-vindas ativadas. Quem assinar a partir de agora recebe na hora.",
              "Welcome message on. New subscribers receive it instantly.",
            )
          : tr("Boas-vindas salvas e desativadas.", "Welcome message saved and turned off."),
      );
    } catch (err) {
      toast.error(describeError(err, tr));
    } finally {
      setBusy(false);
    }
  };

  const mediaLabel = tpl.media_path ? tpl.media_path.split("/").pop() : null;

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-center gap-2">
          <MessageSquareHeart className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">{tr("Boas-vindas automáticas", "Auto welcome message")}</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {tr(
            "Assim que alguém assinar, esta mensagem chega no chat como se você tivesse enviado. Dica: agradeça e já ofereça um conteúdo pago exclusivo — é onde as grandes plataformas mais vendem PPV.",
            "As soon as someone subscribes, this message lands in the chat as if you sent it. Tip: thank them and offer an exclusive paid media right away.",
          )}
        </p>

        <Card className="space-y-5 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-foreground">
                {tr("Enviar boas-vindas automaticamente", "Send welcome automatically")}
              </p>
              <p className="text-xs text-muted-foreground">
                {exists ? tr("Configurada.", "Configured.") : tr("Ainda não configurada.", "Not configured yet.")}
              </p>
            </div>
            <Switch checked={tpl.enabled} onCheckedChange={(v) => setTpl((t) => ({ ...t, enabled: v }))} />
          </div>

          <div>
            <Label htmlFor="welcome-body">{tr("Mensagem", "Message")}</Label>
            <Textarea
              id="welcome-body"
              value={tpl.body}
              maxLength={2000}
              rows={5}
              placeholder={tr(
                "Oi, amor! Que bom te ter aqui 💕 Preparei um conteúdo especial só pra quem acabou de chegar — dá uma olhada 👇",
                "Hey! So glad you're here 💕 I made something special for new subscribers — take a look 👇",
              )}
              onChange={(e) => setTpl((t) => ({ ...t, body: e.target.value }))}
              className="mt-1.5"
            />
            <p className="mt-1 text-right text-[11px] text-muted-foreground">{tpl.body.length}/2000</p>
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-background p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">{tr("Mídia (opcional)", "Media (optional)")}</p>
                <p className="text-xs text-muted-foreground">
                  {mediaLabel ?? tr("Foto ou vídeo enviado junto com a mensagem.", "Photo or video sent with the message.")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
                  {tpl.media_path ? tr("Trocar", "Replace") : tr("Anexar", "Attach")}
                  <input type="file" accept="image/*,video/*" className="hidden" onChange={pickMedia} disabled={uploading} />
                </label>
                {tpl.media_path && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setTpl((t) => ({ ...t, media_path: null, mime_type: null }));
                      setPriceStr("");
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
            {tpl.media_path && (
              <div className="flex flex-wrap items-center gap-3">
                <Label htmlFor="welcome-price" className="text-xs">
                  {tr("Cobrar para desbloquear (R$)", "Charge to unlock (R$)")}
                </Label>
                <Input
                  id="welcome-price"
                  inputMode="decimal"
                  placeholder={tr("0,00 = grátis", "0.00 = free")}
                  value={priceStr}
                  onChange={(e) => setPriceStr(e.target.value.replace(/[^\d,.]/g, ""))}
                  className="h-9 w-36"
                />
                <p className="text-[11px] text-muted-foreground">
                  {tr("Deixe vazio para enviar a mídia liberada.", "Leave blank to send the media unlocked.")}
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button
              onClick={save}
              disabled={busy || uploading}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : tr("Salvar boas-vindas", "Save welcome message")}
            </Button>
          </div>
        </Card>

        <p className="text-xs text-muted-foreground">
          {tr(
            "Cada fã recebe a boas-vindas uma única vez, mesmo que renove ou volte a assinar. Se você bloquear alguém, a mensagem não é enviada.",
            "Each fan receives the welcome only once, even if they renew or resubscribe. Blocked users never receive it.",
          )}
        </p>
      </div>
    </AppShell>
  );
}
