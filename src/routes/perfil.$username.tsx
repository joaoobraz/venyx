import { createFileRoute } from "@tanstack/react-router";
import { CLIENT_PROFILE_PREVIEW } from "@/lib/creator-profile-preview";
import { ProfilePage } from "./profile.$username";

export const Route = createFileRoute("/perfil/$username")({
  validateSearch: (search: Record<string, unknown>) => ({
    coupon: typeof search.coupon === "string" ? search.coupon : undefined,
    via: search.via === "venyx_search" ? "venyx_search" : undefined,
    preview: search.preview === CLIENT_PROFILE_PREVIEW ? CLIENT_PROFILE_PREVIEW : undefined,
  }),
  component: ProfilePage,
});
