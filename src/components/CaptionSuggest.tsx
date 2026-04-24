import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const MOODS = [
  { id: "flerte", label: "Flerte" },
  { id: "misterioso", label: "Misterioso" },
  { id: "engracado", label: "Divertido" },
  { id: "provocante", label: "Provocante" },
  { id: "romantico", label: "Romântico" },
] as const;

type Mood = (typeof MOODS)[number]["id"];

export function CaptionSuggest({
  hint,
  onPick,
}: {
  hint?: string;
  onPick: (caption: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mood, setMood] = useState<Mood>("flerte");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);

  const generate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-caption", {
        body: { hint: hint || "", mood, n: 3 },
      });
      if (error) throw error;
      const captions = (data as { captions?: string[] })?.captions ?? [];
      if (captions.length === 0) throw new Error("Sem sugestões");
      setResults(captions);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao sugerir");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2 rounded-xl border border-accent/30 bg-accent/5 p-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 text-xs font-semibold text-accent"
      >
        <Sparkles className="h-3.5 w-3.5" />
        Sugerir legenda com IA
      </button>
      {open && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {MOODS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMood(m.id)}
                className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                  mood === m.id ? "bg-accent text-accent-foreground" : "bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                {m.label}
              </button>
            ))}
            <button
              type="button"
              onClick={generate}
              disabled={loading}
              className="ml-auto inline-flex items-center gap-1 rounded-full bg-gradient-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground shadow-glow disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              Gerar
            </button>
          </div>
          {results.length > 0 && (
            <ul className="space-y-1.5">
              {results.map((c, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(c);
                      toast.success("Legenda aplicada");
                    }}
                    className="w-full rounded-lg bg-background px-3 py-2 text-left text-xs text-foreground hover:bg-background/70"
                  >
                    {c}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
