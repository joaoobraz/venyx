import { createFileRoute } from "@tanstack/react-router";
import { requireAdminRoute } from "@/lib/admin-route-guard";
import { AdminReconciliationPage } from "./admin.reconciliation";

export const Route = createFileRoute("/administracao/conciliacao")({
  beforeLoad: () => requireAdminRoute("/administracao/conciliacao"),
  component: AdminReconciliationPage,
});
