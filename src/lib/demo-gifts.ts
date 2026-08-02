import { getDemoCreator } from "@/lib/demo-creators";

export type PublicGiftItem = {
  id: string;
  title: string;
  description: string;
  category: string;
  emoji: string;
  value_cents: number;
  received_count: number;
};

export const GIFT_CATEGORY_LABELS: Record<string, { pt: string; en: string }> = {
  lingerie: { pt: "Lingerie", en: "Lingerie" },
  adult_wellness: { pt: "Bem-estar adulto", en: "Adult wellness" },
  equipment: { pt: "Equipamentos", en: "Equipment" },
  beauty: { pt: "Beleza", en: "Beauty" },
  experience: { pt: "Experiências", en: "Experiences" },
  custom: { pt: "Outros", en: "Other" },
};

export const GIFT_PRESETS: Array<Omit<PublicGiftItem, "id" | "received_count">> = [
  {
    title: "Conjunto de lingerie",
    description: "Um mimo simbólico para uma produção especial.",
    category: "lingerie",
    emoji: "👙",
    value_cents: 14900,
  },
  {
    title: "Vibrador / bem-estar",
    description: "Um mimo simbólico escolhido para autocuidado.",
    category: "adult_wellness",
    emoji: "💜",
    value_cents: 19900,
  },
  {
    title: "Tripé para gravação",
    description: "Apoie a estrutura dos próximos conteúdos.",
    category: "equipment",
    emoji: "🎥",
    value_cents: 12000,
  },
  {
    title: "Iluminação para conteúdo",
    description: "Ajude a deixar a próxima produção ainda mais bonita.",
    category: "equipment",
    emoji: "💡",
    value_cents: 18000,
  },
  {
    title: "Dia de beleza",
    description: "Um carinho simbólico para beleza e autocuidado.",
    category: "beauty",
    emoji: "✨",
    value_cents: 25000,
  },
];

export function getDemoGiftList(username: string) {
  const creator = getDemoCreator(username);
  if (!creator) return null;
  return {
    creator,
    settings: {
      title: "Minha Lista de Mimos",
      intro: "Escolha um mimo simbólico para apoiar minhas próximas produções.",
      thank_you_message: "Obrigada por fazer parte disso! 💝",
      is_published: true,
    },
    items: GIFT_PRESETS.slice(0, 4).map((item, index) => ({
      ...item,
      id: `demo-gift-${creator.username}-${index + 1}`,
      received_count: [8, 5, 12, 7][index],
    })),
  };
}
