import { createFileRoute } from "@tanstack/react-router";
import { requireAdminRoute } from "@/lib/admin-route-guard";
import { AdminSupportPage } from "./admin.support";

export const Route = createFileRoute("/administracao/suporte")({
  beforeLoad: () => requireAdminRoute("/administracao/suporte"),
  component: AdminSupportPage,
});
