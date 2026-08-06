import type { DemoPreviewRole } from "@/lib/auth";

export const CLIENT_PROFILE_PREVIEW = "client" as const;

export function canPreviewOwnProfileAsClient(input: {
  requested: boolean;
  authenticatedUserId?: string | null;
  profileUserId?: string | null;
  isCreator: boolean;
  demoPreviewRole?: DemoPreviewRole | null;
}) {
  if (!input.requested || !input.profileUserId) return false;
  if (input.demoPreviewRole === "creator") return input.profileUserId === "demo-aline";
  return Boolean(
    input.isCreator &&
    input.authenticatedUserId &&
    input.authenticatedUserId === input.profileUserId,
  );
}

export function previewOnlyMessage(locale: "pt-BR" | "en") {
  return locale === "en"
    ? "Client preview only. No interaction, purchase or subscription will be created."
    : "Pré-visualização como cliente. Nenhuma interação, compra ou assinatura será criada.";
}
