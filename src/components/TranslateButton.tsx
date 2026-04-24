import { useState } from "react";
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
 * Botão de tradução com confirmação prévia, estado de loading
 * e mensagem clara quando o provedor está rate-limited (429) ou sem créditos (402).
 */
export function TranslateButton({ text, target = "pt-BR" }: { text: string; target?: string }) {
  const [translated, setTranslated] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const reset = () => {
    setError(null);
    setRateLimited(false);
  };

  const doTranslate = async () => {
    reset();
    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("translate-message", {
        body: { text, target },
      });

      // Edge function returned an HTTP error (status code surfaced via FunctionsHttpError)
      if (fnError) {
        const status = (fnError as { context?: { status?: number } })?.context?.status;
        if (status === 429) {
          setRateLimited(true);
          setError("A IA está sobrecarregada agora. Tente novamente em alguns segundos.");
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
      if (!t) {
        throw new Error(payload?.error || "Sem resposta do tradutor");
      }
      setTranslated(t);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao traduzir";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const onClick = () => {
    if (translated) {
      setTranslated(null);
      reset();
      return;
    }
    if (error || rateLimited) {
      // permite re-tentar direto sem reabrir o confirm
      doTranslate();
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
        <div className="flex items-start gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{error}</span>
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
                doTranslate();
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
