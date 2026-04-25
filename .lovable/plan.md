## Objetivo
Remover os ícones de "estrelinhas" (Sparkles ✨) do app, que dão aparência de site gerado por IA, e substituir por ícones neutros/profissionais ou removê-los.

## Onde aparecem hoje

| # | Local | Onde é usado | Ação proposta |
|---|---|---|---|
| 1 | `src/components/BecomeCreatorBanner.tsx` | Banner "Tornar-se criador(a)" no feed (o da imagem que você enviou) | Trocar `Sparkles` por `Crown` (coroa) — combina mais com "criador" |
| 2 | `src/components/Sidebar.tsx` | Link "Tornar-se criador(a)" na sidebar | Trocar `Sparkles` por `Crown` |
| 3 | `src/routes/become-creator.tsx` | Página de cadastro de criador | Trocar `Sparkles` por `Crown` |
| 4 | `src/routes/index.tsx` | Card de feature na landing | Trocar `Sparkles` por `Heart` ou `Star` (sólida) |
| 5 | `src/routes/explore.tsx` | Header da seção "Recomendados" | Trocar `Sparkles` por `Compass` |
| 6 | `src/routes/links.$username.tsx` | Página pública de links | Trocar por `Link2` ou remover |
| 7 | `src/routes/creator.links.tsx` | Painel de gerenciamento de links | Trocar por `Link2` ou remover |
| 8 | `src/routes/creator.mailing.tsx` | Painel de mailing | Trocar por `Mail` ou remover |
| 9 | `src/routes/admin.users.tsx` / `admin.index.tsx` / `palette-preview.tsx` | Áreas internas/admin | Trocar por ícones neutros |
| 10 | `src/components/CaptionSuggest.tsx` | Botão "Sugerir legenda com IA" | **Manter** — aqui é literalmente uma feature de IA, faz sentido o ícone ✨ |

## Resumo da troca
- **Padrão de substituição**:
  - Contextos de "criador/premium" → `Crown`
  - Contextos de "destaque/recomendado" → `Compass` ou `TrendingUp`
  - Contextos de "links" → `Link2`
  - Contextos de "email/mailing" → `Mail`
- **Exceção**: `CaptionSuggest` mantém o Sparkles, pois é a única feature realmente de IA no app (sugestão de legenda via Lovable AI) e o ícone ali é apropriado.

## Pergunta
Você quer manter o Sparkles no `CaptionSuggest` (botão "Sugerir legenda com IA") por ser feature real de IA, ou prefere remover de **todo lugar sem exceção**? Se não responder, vou manter só nesse botão.