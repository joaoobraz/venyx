import { useEffect, useRef, useState } from "react";
import { Languages, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useI18n } from "@/lib/i18n";

/**
 * Botão de tradução com confirmação prévia, estado de loading,
 * e auto-retry com contagem regressiva quando o provedor responde 429 (rate-limit).
 *
 * Backoff: 5s → 10s → 20s → 40s (máx). Após 4 tentativas, aguarda decisão manual.
 */
const RETRY_DELAYS = [5, 10, 20, 40];

export function TranslateButton({ text, target }: { text: string; target?: string }) {
  const { locale, tr } = useI18n();
  const effectiveTarget = target ?? (locale === "en" ? "en" : "pt-BR");
  const [translated, setTranslated] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [retryIn, setRetryIn] = useState<number | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Limpa qualquer timer pendente.
  const clearTimer = () => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  };
  useEffect(() => () => clearTimer(), []);

  const reset = () => {
    setError(null);
    setRateLimited(false);
    setRetryIn(null);
    setRetryAttempt(0);
    clearTimer();
  };

  const scheduleRetry = (attempt: number) => {
    const delay = RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)];
    setRetryIn(delay);
    clearTimer();
    tickRef.current = setInterval(() => {
      setRetryIn((s) => {
        if (s == null) return null;
        if (s <= 1) {
          clearTimer();
          // dispara nova tentativa
          void doTranslate(attempt + 1);
          return null;
        }
        return s - 1;
      });
    }, 1000);
  };

  const doTranslate = async (attempt = 0) => {
    setError(null);
    setRateLimited(false);
    setRetryIn(null);
    setLoading(true);
    setRetryAttempt(attempt);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("translate-message", {
        body: { text, target: effectiveTarget },
      });

      if (fnError) {
        const status = (fnError as { context?: { status?: number } })?.context?.status;
        if (status === 429) {
          setRateLimited(true);
          if (attempt < RETRY_DELAYS.length) {
            setError(tr("IA sobrecarregada. Nova tentativa automática em alguns segundos…", "AI is busy. Retrying automatically in a few seconds…"));
            scheduleRetry(attempt);
          } else {
            setError(tr("IA continua sobrecarregada. Tente novamente manualmente.", "AI is still busy. Please try again manually."));
          }
          return;
        }
        if (status === 402) {
          setError(tr("Créditos de IA esgotados. Tente mais tarde.", "AI credits are unavailable. Please try later."));
          return;
        }
        throw fnError;
      }

      const payload = data as { translation?: string; error?: string } | null;
      const t = payload?.translation;
      if (!t) throw new Error(payload?.error || tr("Sem resposta do tradutor", "No response from translator"));
      setTranslated(t);
      setRetryAttempt(0);
    } catch (e) {
      const msg = e instanceof Error ? e.message : tr("Falha ao traduzir", "Translation failed");
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const cancelRetry = () => {
    clearTimer();
    setRetryIn(null);
    setError(tr("Nova tentativa cancelada. Toque para tentar novamente.", "Retry canceled. Tap to try again."));
  };

  const onClick = () => {
    if (translated) {
      setTranslated(null);
      reset();
      return;
    }
    if (retryIn != null) {
      // usuário clicou durante a espera → tenta agora
      clearTimer();
      setRetryIn(null);
      void doTranslate(retryAttempt + 1);
      return;
    }
    if (error || rateLimited) {
      void doTranslate(0);
      return;
    }
    setConfirmOpen(true);
  };

  return (
    <div className="space-y-1">
      <button
        onClick={onClick}
        disabled={loading}
        className="inline-flex items-center gap-1 text-[10px] font-medium opacity-70 transition-opacity hover:opacity-100 disabled:cursor-wait disabled:opacity-50"
        type="button"
      >
        {loading ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            {tr("Traduzindo…", "Translating…")}
          </>
        ) : retryIn != null ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin text-amber-500" />
            {tr(`Nova tentativa em ${retryIn}s · tocar para tentar agora`, `Retrying in ${retryIn}s · tap to try now`)}
          </>
        ) : rateLimited || error ? (
          <>
            <AlertTriangle className="h-3 w-3 text-destructive" />
            {tr("Tentar novamente", "Try again")}
          </>
        ) : (
          <>
            <Languages className="h-3 w-3" />
            {translated ? tr("Ocultar tradução", "Hide translation") : tr("Traduzir", "Translate")}
          </>
        )}
      </button>

      {translated && (
        <div className="rounded-md bg-background/40 px-2 py-1 text-xs italic opacity-90">{translated}</div>
      )}

      {error && !translated && (
        <div className="flex flex-col gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
          <div className="flex items-start gap-1.5">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            <span className="flex-1">{error}</span>
          </div>
          {retryIn != null && (
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  cancelRetry();
                }}
                className="text-[10px] underline opacity-80 hover:opacity-100"
              >
                {tr("Cancelar", "Cancel")}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  clearTimer();
                  setRetryIn(null);
                  void doTranslate(retryAttempt + 1);
                }}
                className="rounded-md bg-destructive px-2 py-0.5 text-[10px] font-medium text-destructive-foreground hover:opacity-90"
              >
                {tr("Tentar agora", "Try now")}
              </button>
            </div>
          )}
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tr("Traduzir esta mensagem?", "Translate this message?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {tr(
                "O texto será enviado ao provedor de IA para tradução automática. A tradução é apenas uma sugestão e pode conter imprecisões.",
                "The text will be sent to the AI provider for automatic translation. The translation is a suggestion and may contain inaccuracies.",
              )}{" "}
              <strong>({effectiveTarget})</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tr("Cancelar", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                void doTranslate(0);
              }}
            >
              {tr("Traduzir", "Translate")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
