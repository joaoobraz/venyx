import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Heart, MessageCircle, Lock, Crown, Sparkles } from "lucide-react";

export const Route = createFileRoute("/palette-preview")({
  head: () => ({
    meta: [
      { title: "Comparar paletas — Venyx" },
      { name: "description", content: "Pré-visualização das paletas escuras." },
    ],
  }),
  component: PalettePreview,
});

type Palette = {
  id: string;
  name: string;
  tagline: string;
  vars: Record<string, string>;
};

const palettes: Palette[] = [
  {
    id: "midnight-gold",
    name: "Midnight Gold",
    tagline: "Preto + Champanhe (atual)",
    vars: {
      "--p-bg": "oklch(0.10 0.003 60)",
      "--p-fg": "oklch(0.95 0.018 80)",
      "--p-card": "oklch(0.16 0.004 60)",
      "--p-muted": "oklch(0.66 0.015 75)",
      "--p-primary": "oklch(0.82 0.10 82)",
      "--p-primary-fg": "oklch(0.10 0.003 60)",
      "--p-accent": "oklch(0.62 0.13 70)",
      "--p-border": "oklch(0.82 0.10 82 / 18%)",
      "--p-grad": "linear-gradient(135deg, oklch(0.88 0.09 84) 0%, oklch(0.82 0.10 82) 50%, oklch(0.62 0.13 70) 100%)",
    },
  },
  {
    id: "bordeaux-gold",
    name: "Bordeaux Velvet",
    tagline: "Vinho profundo + Dourado",
    vars: {
      "--p-bg": "oklch(0.14 0.04 18)",
      "--p-fg": "oklch(0.96 0.015 80)",
      "--p-card": "oklch(0.20 0.05 16)",
      "--p-muted": "oklch(0.68 0.03 30)",
      "--p-primary": "oklch(0.78 0.12 78)",
      "--p-primary-fg": "oklch(0.14 0.04 18)",
      "--p-accent": "oklch(0.45 0.16 14)",
      "--p-border": "oklch(0.78 0.12 78 / 20%)",
      "--p-grad": "linear-gradient(135deg, oklch(0.85 0.11 82) 0%, oklch(0.62 0.13 70) 50%, oklch(0.40 0.18 14) 100%)",
    },
  },
  {
    id: "graphite-rose",
    name: "Graphite Rosé",
    tagline: "Grafite + Rosé Gold",
    vars: {
      "--p-bg": "oklch(0.13 0.005 280)",
      "--p-fg": "oklch(0.96 0.012 60)",
      "--p-card": "oklch(0.19 0.008 280)",
      "--p-muted": "oklch(0.66 0.02 50)",
      "--p-primary": "oklch(0.78 0.10 35)",
      "--p-primary-fg": "oklch(0.13 0.005 280)",
      "--p-accent": "oklch(0.58 0.14 28)",
      "--p-border": "oklch(0.78 0.10 35 / 20%)",
      "--p-grad": "linear-gradient(135deg, oklch(0.86 0.08 40) 0%, oklch(0.74 0.11 30) 50%, oklch(0.55 0.14 25) 100%)",
    },
  },
];

function PaletteCard({ p, selected, onSelect }: { p: Palette; selected: boolean; onSelect: () => void }) {
  return (
    <div
      style={p.vars as React.CSSProperties}
      className={`rounded-2xl overflow-hidden border transition-all ${
        selected ? "ring-2 ring-primary scale-[1.01]" : ""
      }`}
    >
      <div
        style={{
          backgroundColor: "var(--p-bg)",
          color: "var(--p-fg)",
          borderColor: "var(--p-border)",
        }}
        className="p-5 space-y-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-xl" style={{ color: "var(--p-fg)" }}>
              {p.name}
            </h3>
            <p className="text-xs" style={{ color: "var(--p-muted)" }}>
              {p.tagline}
            </p>
          </div>
          <div
            className="h-10 w-10 rounded-full"
            style={{ background: "var(--p-grad)" }}
          />
        </div>

        {/* Swatches */}
        <div className="flex gap-1.5">
          {["--p-bg", "--p-card", "--p-primary", "--p-accent", "--p-fg"].map((v) => (
            <div
              key={v}
              className="h-7 flex-1 rounded-md border"
              style={{ backgroundColor: `var(${v})`, borderColor: "var(--p-border)" }}
              title={v}
            />
          ))}
        </div>

        {/* Mock card */}
        <div
          className="rounded-xl p-4 space-y-3 border"
          style={{ backgroundColor: "var(--p-card)", borderColor: "var(--p-border)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-full"
              style={{ background: "var(--p-grad)" }}
            />
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold" style={{ color: "var(--p-fg)" }}>
                  Sofia Luxe
                </span>
                <Crown className="h-3.5 w-3.5" style={{ color: "var(--p-primary)" }} />
              </div>
              <span className="text-xs" style={{ color: "var(--p-muted)" }}>
                @sofialuxe · 2h
              </span>
            </div>
          </div>

          <p className="text-sm" style={{ color: "var(--p-fg)" }}>
            Conteúdo exclusivo para meus assinantes ✨
          </p>

          {/* Locked media */}
          <div
            className="aspect-[4/3] rounded-lg flex items-center justify-center relative overflow-hidden"
            style={{ background: "var(--p-grad)", opacity: 0.85 }}
          >
            <div
              className="absolute inset-0"
              style={{ backgroundColor: "var(--p-bg)", opacity: 0.5 }}
            />
            <div className="relative flex flex-col items-center gap-2">
              <Lock className="h-6 w-6" style={{ color: "var(--p-fg)" }} />
              <span
                className="text-xs font-semibold px-3 py-1 rounded-full"
                style={{
                  backgroundColor: "var(--p-primary)",
                  color: "var(--p-primary-fg)",
                }}
              >
                R$ 9,90
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4 pt-1">
            <button className="flex items-center gap-1.5 text-sm" style={{ color: "var(--p-muted)" }}>
              <Heart className="h-4 w-4" /> 1.2k
            </button>
            <button className="flex items-center gap-1.5 text-sm" style={{ color: "var(--p-muted)" }}>
              <MessageCircle className="h-4 w-4" /> 84
            </button>
          </div>
        </div>

        {/* Buttons */}
        <div className="space-y-2">
          <button
            className="w-full h-10 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: "var(--p-grad)", color: "var(--p-primary-fg)" }}
          >
            <span className="inline-flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Assinar agora
            </span>
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              className="h-9 rounded-lg text-sm font-medium border"
              style={{
                borderColor: "var(--p-primary)",
                color: "var(--p-primary)",
                backgroundColor: "transparent",
              }}
            >
              Seguir
            </button>
            <button
              className="h-9 rounded-lg text-sm font-medium"
              style={{
                backgroundColor: "var(--p-accent)",
                color: "var(--p-fg)",
              }}
            >
              Mensagem
            </button>
          </div>
        </div>

        {/* Select */}
        <button
          onClick={onSelect}
          className={`w-full h-10 rounded-lg text-sm font-semibold border-2 transition-all ${
            selected ? "" : "hover:opacity-80"
          }`}
          style={{
            borderColor: "var(--p-primary)",
            backgroundColor: selected ? "var(--p-primary)" : "transparent",
            color: selected ? "var(--p-primary-fg)" : "var(--p-primary)",
          }}
        >
          {selected ? "✓ Escolhida" : "Escolher esta"}
        </button>
      </div>
    </div>
  );
}

function PalettePreview() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="text-center space-y-2">
          <h1 className="font-display text-4xl text-gradient-gold">Compare as paletas</h1>
          <p className="text-muted-foreground">
            Veja as 3 opções lado a lado com botões e cards reais. Clique em "Escolher esta" e me diga
            qual prefere no chat.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {palettes.map((p) => (
            <PaletteCard
              key={p.id}
              p={p}
              selected={selected === p.id}
              onSelect={() => setSelected(p.id)}
            />
          ))}
        </div>

        {selected && (
          <div className="text-center p-4 rounded-xl bg-card border border-border">
            <p className="text-sm">
              Você escolheu:{" "}
              <strong className="text-primary">
                {palettes.find((p) => p.id === selected)?.name}
              </strong>
              . Volte ao chat e me diga "aplica a {palettes.find((p) => p.id === selected)?.name}".
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
