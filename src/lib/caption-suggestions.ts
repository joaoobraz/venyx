export type CaptionMood =
  | "flerte"
  | "misterioso"
  | "engracado"
  | "provocante"
  | "romantico";

const CAPTION_TEMPLATES: Record<CaptionMood, string[]> = {
  flerte: [
    "Cheguei por aqui com uma novidade que merece sua atenção.",
    "Um detalhe de hoje que eu quis dividir primeiro com você.",
    "A prévia está liberada. O restante eu conto bem de perto.",
  ],
  misterioso: [
    "Nem tudo precisa ser revelado de uma vez.",
    "Tem novidade chegando, mas essa prévia já diz bastante.",
    "Uma pequena pista do que preparei para hoje.",
  ],
  engracado: [
    "Eu disse que seria só uma foto e claramente não consegui escolher uma só.",
    "O plano era fazer algo simples. O resultado decidiu aparecer mais.",
    "Bastidores oficialmente aprovados pelo meu lado perfeccionista.",
  ],
  provocante: [
    "Essa prévia é só o começo do que preparei.",
    "Conteúdo novo no ar para quem gosta de chegar primeiro.",
    "Você escolhe: fica só na prévia ou descobre o restante?",
  ],
  romantico: [
    "Preparei cada detalhe com carinho para compartilhar com você.",
    "Um registro especial de um momento que eu queria guardar por aqui.",
    "Hoje a publicação vem com calma, cuidado e um pouco de saudade.",
  ],
};

export function buildCaptionSuggestions(input: {
  mood: CaptionMood;
  hint?: string;
}): string[] {
  const hint = input.hint?.replace(/\s+/g, " ").trim().slice(0, 90);
  const templates = CAPTION_TEMPLATES[input.mood];
  if (!hint) return templates;

  return [
    `${hint} — e isso é só uma prévia.`,
    `${templates[1]} ${hint}`,
    `${hint}. Quero saber o que você achou.`,
  ];
}
