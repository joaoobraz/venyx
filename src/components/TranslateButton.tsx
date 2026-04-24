import { useState } from "react";
import { Languages, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Botão pequeno que traduz uma string usando a edge function `translate-message`.
 * Mostra a tradução logo abaixo do original.
 */
export function TranslateButton({ text, target = "pt-BR" }: { text: string; target?: string }) {
  const [translated, setTranslated] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (translated) {
      setTranslated(null);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("translate-message", {
        body: { text, target },
      });
      if (error) throw error;
      const t = (data as { translation?: string; error?: string })?.translation;
      if (!t) throw new Error((data as { error?: string })?.error || "Sem resposta");
      setTranslated(t);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao traduzir");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-1">
      <button
        onClick={run}
        className="inline-flex items-center gap-1 text-[10px] font-medium opacity-70 hover:opacity-100"
        type="button"
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Languages className="h-3 w-3" />}
        {translated ? "Ocultar tradução" : "Traduzir"}
      </button>
      {translated && (
        <div className="rounded-md bg-background/40 px-2 py-1 text-xs italic opacity-90">{translated}</div>
      )}
    </div>
  );
}
