import { createFileRoute } from "@tanstack/react-router";
import { CLIENT_PROFILE_PREVIEW } from "@/lib/creator-profile-preview";
import { PublicGiftListPage } from "./gifts.$username";

export const Route = createFileRoute("/regalos/$username")({
  validateSearch: (search: Record<string, unknown>) => ({
    preview: search.preview === CLIENT_PROFILE_PREVIEW ? CLIENT_PROFILE_PREVIEW : undefined,
  }),
  component: PublicGiftListPage,
});
