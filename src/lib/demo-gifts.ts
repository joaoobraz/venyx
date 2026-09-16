import { getDemoCreator } from "./demo-creators.ts";
import {
  createDemoOperationsSeed,
  readDemoOperations,
  type DemoGiftItem,
} from "./demo-operations.ts";

export type GiftAvailability = "available" | "on_request";

export type PublicGiftItem = {
  id: string;
  title: string;
  description: string;
  emoji: string;
  image_url: string | null;
  value_cents: number;
  received_count: number;
  availability: GiftAvailability;
  track_stock: boolean;
  stock_quantity: number | null;
};

export type GiftPreset = Omit<
  DemoGiftItem,
  "id" | "received_count" | "received_cents" | "active" | "source"
>;

export const GIFT_PRESETS: GiftPreset[] = [
  {
    title: "Conjunto de lingerie",
    description: "Conjunto selecionado para novas produções.",
    emoji: "👙",
    image_url: null,
    value_cents: 14_900,
    availability: "available",
    track_stock: false,
    stock_quantity: null,
  },
  {
    title: "Kit de autocuidado",
    description: "Kit especial de beleza e autocuidado.",
    emoji: "💜",
    image_url: null,
    value_cents: 19_900,
    availability: "available",
    track_stock: false,
    stock_quantity: null,
  },
  {
    title: "Tripé para gravação",
    description: "Equipamento para os próximos conteúdos.",
    emoji: "🎥",
    image_url: null,
    value_cents: 12_000,
    availability: "available",
    track_stock: true,
    stock_quantity: 12,
  },
  {
    title: "Iluminação para conteúdo",
    description: "Iluminação para novas fotos e vídeos.",
    emoji: "💡",
    image_url: null,
    value_cents: 18_000,
    availability: "on_request",
    track_stock: false,
    stock_quantity: null,
  },
  {
    title: "Dia de beleza",
    description: "Experiência de beleza escolhida pela modelo.",
    emoji: "🎁",
    image_url: null,
    value_cents: 25_000,
    availability: "on_request",
    track_stock: false,
    stock_quantity: null,
  },
];

export function isGiftItemPurchasable(
  item: Pick<DemoGiftItem, "active" | "track_stock" | "stock_quantity">,
) {
  return item.active && (!item.track_stock || (item.stock_quantity ?? 0) > 0);
}

export function getDemoGiftList(username: string, viewerUserId?: string | null) {
  const creator = getDemoCreator(username);
  if (!creator) return null;
  const operations = viewerUserId ? readDemoOperations(viewerUserId) : createDemoOperationsSeed();
  return {
    creator,
    settings: {
      title: "Minha Lista de Mimos",
      intro: "Escolha um produto da minha lista para tornar minhas próximas ideias realidade.",
      thank_you_message: "Obrigada por fazer parte disso! 💝",
      is_published: true,
    },
    items: operations.giftItems
      .filter(isGiftItemPurchasable)
      .map(
        ({
          id,
          title,
          description,
          emoji,
          image_url,
          value_cents,
          received_count,
          availability,
          track_stock,
          stock_quantity,
        }): PublicGiftItem => ({
          id,
          title,
          description,
          emoji,
          image_url,
          value_cents,
          received_count,
          availability,
          track_stock,
          stock_quantity,
        }),
      ),
  };
}
