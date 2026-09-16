import { createFileRoute } from "@tanstack/react-router";
import { requireAdminRoute } from "@/lib/admin-route-guard";
import { AdminModerationPage } from "./admin.moderation";

export const Route = createFileRoute("/administracao/moderacao")({
  beforeLoad: () => requireAdminRoute("/administracao/moderacao"),
  component: AdminModerationPage,
});
