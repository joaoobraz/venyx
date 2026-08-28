import { createFileRoute } from "@tanstack/react-router";
import { requireAdminRoute } from "@/lib/admin-route-guard";
import { AdminActionsAuditPage } from "./admin.actions-audit";

export const Route = createFileRoute("/administracao/auditoria-acoes")({
  beforeLoad: () => requireAdminRoute("/administracao/auditoria-acoes"),
  component: AdminActionsAuditPage,
});
