import { createFileRoute } from "@tanstack/react-router";
import { requireAdminRoute } from "@/lib/admin-route-guard";
import { AdminAuditPage } from "./admin.audit";

export const Route = createFileRoute("/administracion/auditoria")({
  beforeLoad: () => requireAdminRoute("/administracion/auditoria"),
  component: AdminAuditPage,
});
