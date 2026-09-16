import { createFileRoute } from "@tanstack/react-router";
import { requireAdminRoute } from "@/lib/admin-route-guard";
import { AdminModerationPage } from "./admin.moderation";

export const Route = createFileRoute("/administracion/moderacion")({
  beforeLoad: () => requireAdminRoute("/administracion/moderacion"),
  component: AdminModerationPage,
});
