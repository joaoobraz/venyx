

# Nova paleta — OnlyFans Blue × Privacy Orange

Vou repaginar o tema da Venyx fundindo o **azul OnlyFans** (#00AFF0) com o **laranja Privacy** (#FF6B1A) sobre o fundo escuro premium que já temos. Apresento 3 direções — me diga qual prefere antes de eu codar.

---

## Opção A — Fusion (recomendada)

Azul como **primary** (marca/CTAs principais) + laranja como **accent** (destaque, badges PPV, "subscribe", preço). Combinação clássica complementar, alto contraste, vibe energética sem perder sofisticação.

```text
Background     #0A1420  (azul-noite quase preto)
Card           #111E2E
Primary        #00AFF0  (OnlyFans blue)
Primary glow   #38C6FF
Accent         #FF6B1A  (Privacy orange)
Accent glow    #FF8A4C
Destructive    #FF3B30
Texto          #F5F7FA
```

**Uso:**
- Botões principais, links, badges de assinatura → azul
- CTAs de monetização (Tip, PPV, Bundle, "Assinar agora") → laranja
- Gradiente hero → azul → laranja diagonal

---

## Opção B — Inverted

Laranja como **primary** (marca quente, +18, calor) + azul como **accent** (confiança, verificado, links). Mais "Privacy-forward".

```text
Primary        #FF6B1A  (laranja)
Accent         #00AFF0  (azul)
Background     #1A0F08  (marrom-noite)
```

---

## Opção C — Sugestão alternativa minha: "Sunset Premium"

Em vez do azul OnlyFans cru (que é meio corporativo/genérico), trocar por um **roxo-magenta vibrante** + laranja. Mais original, foge do "clone óbvio", mantém a vibe sensual/+18 e fica único no mercado BR.

```text
Primary        #E91E63  (magenta vibrante)
Accent         #FF6B1A  (laranja Privacy)
Background     #14080F
Gradient       magenta → laranja (pôr-do-sol)
```

---

## O que vou alterar (técnico)

Apenas **`src/styles.css`**:
- Tokens `:root` e `.dark` (background, card, primary, primary-glow, accent, secondary, muted, border, ring, sidebar-*)
- Tokens de chart (`--chart-1..5`)
- Gradientes (`--gradient-primary`, `--gradient-hero`, `--gradient-card`)
- Sombra glow (`--shadow-glow`) na cor do primary novo

Todos os componentes (Header, Sidebar, PostCard, Botões, Modais, Stories, Chat, Analytics) já consomem esses tokens via Tailwind (`bg-primary`, `text-accent`, etc.), então **mudam automaticamente** sem tocar em nenhum outro arquivo.

---

## Próximo passo

Me responda com **A**, **B** ou **C** (ou peça uma 4ª variação) e eu aplico na próxima mensagem. Se quiser, também posso gerar um screenshot de cada antes — mas o mais rápido é escolher uma e aplicar direto.

