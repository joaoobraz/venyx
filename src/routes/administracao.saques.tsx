import { createFileRoute } from "@tanstack/react-router";
import { requireAdminRoute } from "@/lib/admin-route-guard";
import { AdminPayoutsPage } from "./admin.payouts";

export const Route = createFileRoute("/administracao/saques")({
  beforeLoad: () => requireAdminRoute("/administracao/saques"),
  component: AdminPayoutsPage,
});
