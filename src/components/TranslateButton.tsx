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

/**
 * Botão de tradução com confirmação prévia, estado de loading,
 * e auto-retry com contagem regressiva quando o provedor responde 429 (rate-limit).
 *
 * Backoff: 5s → 10s → 20s → 40s (máx). Após 4 tentativas, aguarda decisão manual.
 */
const RETRY_DELAYS = [5, 10, 20, 40];

export function TranslateButton({ text, target = "pt-BR" }: { text: string; target?: string }) {
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
        body: { text, target },
      });

      if (fnError) {
        const status = (fnError as { context?: { status?: number } })?.context?.status;
        if (status === 429) {
          setRateLimited(true);
          if (attempt < RETRY_DELAYS.length) {
            setError(`IA sobrecarregada. Nova tentativa automática em alguns segundos…`);
            scheduleRetry(attempt);
          } else {
            setError("IA continua sobrecarregada. Tente novamente manualmente.");
          }
          return;
        }
        if (status === 402) {
          setError("Créditos de IA esgotados. Avise a criadora ou tente mais tarde.");
          return;
        }
        throw fnError;
      }

      const payload = data as { translation?: string; error?: string } | null;
      const t = payload?.translation;
      if (!t) throw new Error(payload?.error || "Sem resposta do tradutor");
      setTranslated(t);
      setRetryAttempt(0);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao traduzir";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const cancelRetry = () => {
    clearTimer();
    setRetryIn(null);
    setError("Auto-retry cancelado. Toque para tentar novamente.");
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
            Traduzindo…
          </>
        ) : retryIn != null ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin text-amber-500" />
            Nova tentativa em {retryIn}s · tocar p/ tentar agora
          </>
        ) : rateLimited || error ? (
          <>
            <AlertTriangle className="h-3 w-3 text-destructive" />
            Tentar novamente
          </>
        ) : (
          <>
            <Languages className="h-3 w-3" />
            {translated ? "Ocultar tradução" : "Traduzir"}
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
                Cancelar
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
                Tentar agora
              </button>
            </div>
          )}
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Traduzir esta mensagem?</AlertDialogTitle>
            <AlertDialogDescription>
              O texto será enviado ao provedor de IA para tradução automática para{" "}
              <strong>{target}</strong>. A tradução é apenas uma sugestão e pode conter imprecisões.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                void doTranslate(0);
              }}
            >
              Traduzir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
