import { createFileRoute } from "@tanstack/react-router";
import { requireAdminRoute } from "@/lib/admin-route-guard";
import { AdminActionsAuditPage } from "./admin.actions-audit";

export const Route = createFileRoute("/administracion/auditoria-acciones")({
  beforeLoad: () => requireAdminRoute("/administracion/auditoria-acciones"),
  component: AdminActionsAuditPage,
});
