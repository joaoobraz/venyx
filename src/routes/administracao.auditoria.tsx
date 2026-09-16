import { createFileRoute } from "@tanstack/react-router";
import { requireAdminRoute } from "@/lib/admin-route-guard";
import { AdminAuditPage } from "./admin.audit";

export const Route = createFileRoute("/administracao/auditoria")({
  beforeLoad: () => requireAdminRoute("/administracao/auditoria"),
  component: AdminAuditPage,
});
