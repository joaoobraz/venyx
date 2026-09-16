import { createFileRoute } from "@tanstack/react-router";
import { requireAdminRoute } from "@/lib/admin-route-guard";
import { AdminReconciliationPage } from "./admin.reconciliation";

export const Route = createFileRoute("/administracion/conciliacion")({
  beforeLoad: () => requireAdminRoute("/administracion/conciliacion"),
  component: AdminReconciliationPage,
});
