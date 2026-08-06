export type CampaignObjective =
  | "discount"
  | "promotion"
  | "specific_content"
  | "library_photo"
  | "new_photo"
  | "video"
  | "audio"
  | "ppv"
  | "coupon"
  | "renewal"
  | "recovery"
  | "custom";

export type CampaignAudience =
  | "active_subscribers"
  | "expiring_subscribers"
  | "former_subscribers"
  | "cancelled_subscribers"
  | "profile_viewers"
  | "unpaid_pix"
  | "ppv_buyers"
  | "ppv_non_buyers"
  | "top_spenders"
  | "followers_non_subscribers"
  | "manual";

export type CampaignMediaSource = "none" | "library" | "upload";
export type CampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "cancelled";

export const CAMPAIGN_DAILY_LIMIT = 1_000;
export const CAMPAIGN_MESSAGE_LIMIT = 2_000;

export const CAMPAIGN_OBJECTIVES: Array<{
  id: CampaignObjective;
  label: string;
  labelEn: string;
  description: string;
  descriptionEn: string;
}> = [
  {
    id: "discount",
    label: "Desconto",
    labelEn: "Discount",
    description: "Condição especial por tempo limitado.",
    descriptionEn: "Limited-time special offer.",
  },
  {
    id: "promotion",
    label: "Promoção",
    labelEn: "Promotion",
    description: "Divulgar uma oferta ou novidade.",
    descriptionEn: "Promote an offer or announcement.",
  },
  {
    id: "specific_content",
    label: "Conteúdo específico",
    labelEn: "Specific content",
    description: "Levar o público a um conteúdo escolhido.",
    descriptionEn: "Drive the audience to selected content.",
  },
  {
    id: "library_photo",
    label: "Foto do acervo",
    labelEn: "Library photo",
    description: "Reutilizar uma foto já salva.",
    descriptionEn: "Reuse a saved photo.",
  },
  {
    id: "new_photo",
    label: "Foto nova",
    labelEn: "New photo",
    description: "Importar uma foto no momento da campanha.",
    descriptionEn: "Upload a photo while creating the campaign.",
  },
  {
    id: "video",
    label: "Vídeo",
    labelEn: "Video",
    description: "Enviar um vídeo com mensagem opcional.",
    descriptionEn: "Send a video with an optional message.",
  },
  {
    id: "audio",
    label: "Áudio",
    labelEn: "Audio",
    description: "Enviar uma mensagem de voz ou áudio.",
    descriptionEn: "Send a voice note or audio file.",
  },
  {
    id: "ppv",
    label: "PPV",
    labelEn: "PPV",
    description: "Oferecer mídia bloqueada com preço definido.",
    descriptionEn: "Offer locked media at a set price.",
  },
  {
    id: "coupon",
    label: "Cupom",
    labelEn: "Coupon",
    description: "Divulgar um cupom ativo por link.",
    descriptionEn: "Share an active coupon by link.",
  },
  {
    id: "renewal",
    label: "Renovação de assinatura",
    labelEn: "Subscription renewal",
    description: "Lembrar assinantes próximos do vencimento.",
    descriptionEn: "Remind subscribers nearing expiration.",
  },
  {
    id: "recovery",
    label: "Recuperação de cliente",
    labelEn: "Customer recovery",
    description: "Reativar antigos assinantes e cancelados.",
    descriptionEn: "Win back former and canceled subscribers.",
  },
  {
    id: "custom",
    label: "Mensagem personalizada",
    labelEn: "Custom message",
    description: "Criar uma campanha livre em texto ou mídia.",
    descriptionEn: "Create a custom text or media campaign.",
  },
];

export const CAMPAIGN_AUDIENCES: Array<{
  id: CampaignAudience;
  label: string;
  labelEn: string;
  description: string;
  descriptionEn: string;
  estimate: number;
  privacyReview?: boolean;
}> = [
  {
    id: "active_subscribers",
    label: "Assinantes ativos",
    labelEn: "Active subscribers",
    description: "Pessoas com assinatura válida agora.",
    descriptionEn: "People with a currently valid subscription.",
    estimate: 327,
  },
  {
    id: "expiring_subscribers",
    label: "Próximos do vencimento",
    labelEn: "Expiring subscribers",
    description: "Assinaturas que vencem nos próximos 7 dias.",
    descriptionEn: "Subscriptions expiring in the next 7 days.",
    estimate: 42,
  },
  {
    id: "former_subscribers",
    label: "Já foram assinantes",
    labelEn: "Former subscribers",
    description: "Pessoas sem assinatura ativa que já assinaram.",
    descriptionEn: "Inactive contacts who subscribed before.",
    estimate: 184,
  },
  {
    id: "cancelled_subscribers",
    label: "Cancelaram",
    labelEn: "Canceled subscribers",
    description: "Assinaturas canceladas antes da renovação.",
    descriptionEn: "Subscriptions canceled before renewal.",
    estimate: 67,
  },
  {
    id: "profile_viewers",
    label: "Visualizaram o perfil",
    labelEn: "Profile viewers",
    description: "Aguardando validação de privacidade e consentimento.",
    descriptionEn: "Pending privacy and consent validation.",
    estimate: 0,
    privacyReview: true,
  },
  {
    id: "unpaid_pix",
    label: "Geraram Pix e não pagaram",
    labelEn: "Unpaid PIX leads",
    description: "Aguardando regra de retenção e base legal.",
    descriptionEn: "Pending retention rules and lawful basis.",
    estimate: 0,
    privacyReview: true,
  },
  {
    id: "ppv_buyers",
    label: "Compraram PPV",
    labelEn: "PPV buyers",
    description: "Pessoas com pelo menos uma compra de PPV.",
    descriptionEn: "People with at least one PPV purchase.",
    estimate: 129,
  },
  {
    id: "ppv_non_buyers",
    label: "Nunca compraram PPV",
    labelEn: "Never bought PPV",
    description: "Contatos que ainda não desbloquearam PPV.",
    descriptionEn: "Contacts who have never unlocked PPV.",
    estimate: 286,
  },
  {
    id: "top_spenders",
    label: "Maiores compradores",
    labelEn: "Top spenders",
    description: "Top 10% por valor gasto nos últimos 90 dias.",
    descriptionEn: "Top 10% by spending in the last 90 days.",
    estimate: 38,
  },
  {
    id: "followers_non_subscribers",
    label: "Seguidores sem assinatura",
    labelEn: "Followers without subscription",
    description: "Seguidores que ainda não são assinantes.",
    descriptionEn: "Followers who are not subscribers yet.",
    estimate: 412,
  },
  {
    id: "manual",
    label: "Selecionados manualmente",
    labelEn: "Manually selected",
    description: "Escolha contatos individualmente.",
    descriptionEn: "Choose individual contacts.",
    estimate: 0,
  },
];

export interface CampaignDraftValidationInput {
  title: string;
  objective: CampaignObjective;
  audience: CampaignAudience;
  body: string;
  mediaUrl: string | null;
  ppvPriceCents: number;
  recipients: number;
  scheduledAt: string | null;
}

export function campaignObjectiveLabel(objective: CampaignObjective, locale: "pt-BR" | "en") {
  const item = CAMPAIGN_OBJECTIVES.find((entry) => entry.id === objective);
  return locale === "en" ? (item?.labelEn ?? objective) : (item?.label ?? objective);
}

export function campaignAudienceLabel(audience: CampaignAudience, locale: "pt-BR" | "en") {
  const item = CAMPAIGN_AUDIENCES.find((entry) => entry.id === audience);
  return locale === "en" ? (item?.labelEn ?? audience) : (item?.label ?? audience);
}

export function estimateCampaignAudience(audience: CampaignAudience, manualCount = 0) {
  if (audience === "manual") return manualCount;
  return CAMPAIGN_AUDIENCES.find((entry) => entry.id === audience)?.estimate ?? 0;
}

export function validateCampaignDraft(input: CampaignDraftValidationInput) {
  const errors: string[] = [];
  if (!input.title.trim()) errors.push("Informe o nome da campanha.");
  if (!input.body.trim() && !input.mediaUrl) errors.push("Adicione uma mensagem ou uma mídia.");
  if (input.body.length > CAMPAIGN_MESSAGE_LIMIT) {
    errors.push(`A mensagem pode ter até ${CAMPAIGN_MESSAGE_LIMIT} caracteres.`);
  }
  if (input.objective === "ppv" && input.ppvPriceCents < 100) {
    errors.push("Defina um valor de pelo menos R$ 1,00 para o PPV.");
  }
  if (input.recipients < 1) errors.push("Selecione pelo menos um destinatário.");
  if (input.recipients > CAMPAIGN_DAILY_LIMIT) {
    errors.push(`O limite diário é de ${CAMPAIGN_DAILY_LIMIT} destinatários.`);
  }
  if (input.scheduledAt && new Date(input.scheduledAt).getTime() <= Date.now()) {
    errors.push("Escolha um horário futuro para o agendamento.");
  }
  return errors;
}

export function simulateCampaignReport(recipients: number, objective: CampaignObjective) {
  const delivered = Math.max(0, Math.floor(recipients * 0.982));
  const opened = Math.max(0, Math.floor(delivered * (objective === "renewal" ? 0.71 : 0.63)));
  const salesRate = objective === "ppv" ? 0.12 : objective === "coupon" ? 0.09 : 0.045;
  const sales = Math.max(0, Math.floor(opened * salesRate));
  return { delivered, opened, sales };
}
