import { useState } from "react";
import { PenLine } from "lucide-react";
import { toast } from "sonner";
import {
  buildCaptionSuggestions,
  type CaptionMood,
} from "@/lib/caption-suggestions";

const MOODS: Array<{ id: CaptionMood; label: string }> = [
  { id: "flerte", label: "Flerte" },
  { id: "misterioso", label: "Misterioso" },
  { id: "engracado", label: "Divertido" },
  { id: "provocante", label: "Provocante" },
  { id: "romantico", label: "Romântico" },
];

export function CaptionSuggest({
  hint,
  onPick,
}: {
  hint?: string;
  onPick: (caption: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mood, setMood] = useState<CaptionMood>("flerte");
  const [results, setResults] = useState<string[]>([]);

  const generate = () => {
    setResults(buildCaptionSuggestions({ hint, mood }));
  };

  return (
    <div className="space-y-2 rounded-xl border border-accent/30 bg-accent/5 p-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-2 text-xs font-semibold text-accent"
      >
        <PenLine className="h-3.5 w-3.5" />
        Sugerir legenda
      </button>
      {open && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {MOODS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setMood(item.id)}
                className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                  mood === item.id
                    ? "bg-accent text-accent-foreground"
                    : "bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              onClick={generate}
              className="ml-auto inline-flex items-center gap-1 rounded-full bg-gradient-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground shadow-glow"
            >
              <PenLine className="h-3 w-3" />
              Gerar
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Sugestões geradas no navegador, sem custo por uso.
          </p>
          {results.length > 0 && (
            <ul className="space-y-1.5">
              {results.map((caption) => (
                <li key={caption}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(caption);
                      toast.success("Legenda aplicada");
                    }}
                    className="w-full rounded-lg bg-background px-3 py-2 text-left text-xs text-foreground hover:bg-background/70"
                  >
                    {caption}
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
