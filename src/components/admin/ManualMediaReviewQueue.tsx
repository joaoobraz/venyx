import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Clock, Loader2, RefreshCw, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { listManualMediaReviews, reviewManualMedia } from "@/_server/manual-moderation.functions";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type ReviewStatus = "pending" | "approved" | "rejected";
type Review = {
  id: string;
  surface: "post" | "story" | "chat";
  storage_paths: string[];
  status: ReviewStatus;
  note: string | null;
  created_at: string;
  reviewed_at: string | null;
  username: string | null;
  displayName: string | null;
  body: string | null;
  detail: string | null;
  mediaUrls: string[];
};

export function ManualMediaReviewQueue() {
  const { locale, tr } = useI18n();
  const listFn = useServerFn(listManualMediaReviews);
  const reviewFn = useServerFn(reviewManualMedia);
  const [status, setStatus] = useState<ReviewStatus>("pending");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [deciding, setDeciding] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listFn({ data: { status, limit: 100 } });
      setReviews(result.reviews as Review[]);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : tr("Não foi possível carregar a fila manual.", "Couldn't load the manual queue."),
      );
    } finally {
      setLoading(false);
    }
  }, [listFn, status, tr]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (review: Review, decision: "approved" | "rejected") => {
    const promptText =
      decision === "approved"
        ? tr(
            "Registre o que foi conferido antes de aprovar:",
            "Record what was checked before approving:",
          )
        : tr("Informe o motivo da rejeição:", "Enter the rejection reason:");
    const note = window.prompt(promptText);
    if (!note?.trim() || note.trim().length < 5) {
      toast.error(
        tr("Informe um motivo com pelo menos 5 caracteres.", "Enter at least 5 characters."),
      );
      return;
    }
    setDeciding(review.id);
    try {
      await reviewFn({ data: { reviewId: review.id, decision, note: note.trim() } });
      toast.success(
        decision === "approved"
          ? tr("Conteúdo aprovado e liberado.", "Content approved and released.")
          : tr("Conteúdo rejeitado e mantido oculto.", "Content rejected and kept hidden."),
      );
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : tr("Falha ao decidir.", "Decision failed."),
      );
    } finally {
      setDeciding(null);
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-primary/25 bg-primary/5 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {tr("Fila de publicação manual", "Manual publishing queue")}
          </h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
            {tr(
              "MVP sem fornecedor pago: posts, stories e mídias do chat permanecem privados até uma pessoa administradora conferir maioridade aparente, consentimento e regras da plataforma.",
              "Zero-vendor MVP: posts, stories, and chat media remain private until an administrator checks apparent adulthood, consent, and platform rules.",
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {tr("Atualizar", "Refresh")}
        </Button>
      </div>

      <div className="flex gap-1 rounded-xl bg-background/70 p-1">
        {(["pending", "approved", "rejected"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setStatus(item)}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
              status === item
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {item === "pending"
              ? tr("Pendentes", "Pending")
              : item === "approved"
                ? tr("Aprovados", "Approved")
                : tr("Rejeitados", "Rejected")}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex min-h-28 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {tr("Nenhum conteúdo nesta etapa.", "No content at this stage.")}
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <article key={review.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-sm text-foreground">
                      @{review.username ?? tr("usuário", "user")}
                    </strong>
                    <Badge variant="outline">
                      {review.surface === "post"
                        ? "Post"
                        : review.surface === "story"
                          ? "Story"
                          : "Chat"}
                    </Badge>
                    {review.detail && <Badge variant="secondary">{review.detail}</Badge>}
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {new Date(review.created_at).toLocaleString(locale)}
                  </p>
                </div>
              </div>

              {review.body && (
                <p className="mt-3 whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-sm text-foreground">
                  {review.body}
                </p>
              )}

              {review.mediaUrls.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {review.mediaUrls.map((url, index) => {
                    const path = review.storage_paths[index] ?? "";
                    const isVideo = /\.(mp4|webm)(?:$|\?)/i.test(path);
                    return (
                      <div
                        key={`${review.id}-${index}`}
                        className="overflow-hidden rounded-lg bg-black"
                      >
                        {isVideo ? (
                          <video
                            src={url}
                            controls
                            preload="metadata"
                            className="aspect-[4/5] h-full w-full object-contain"
                          />
                        ) : (
                          <img
                            src={url}
                            alt=""
                            className="aspect-[4/5] h-full w-full object-contain"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {review.note && (
                <p className="mt-3 rounded-lg border border-border/60 p-2 text-xs text-muted-foreground">
                  {tr("Decisão", "Decision")}: {review.note}
                </p>
              )}

              {review.status === "pending" && (
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    disabled={deciding === review.id}
                    onClick={() => void decide(review, "approved")}
                  >
                    {deciding === review.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="mr-1 h-4 w-4" />
                    )}
                    {tr("Aprovar e liberar", "Approve and release")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={deciding === review.id}
                    onClick={() => void decide(review, "rejected")}
                  >
                    <X className="mr-1 h-4 w-4" /> {tr("Rejeitar", "Reject")}
                  </Button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
