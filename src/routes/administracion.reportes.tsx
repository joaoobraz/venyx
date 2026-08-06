import { createFileRoute } from "@tanstack/react-router";
import { requireAdminRoute } from "@/lib/admin-route-guard";
import { ReportsAdminPage } from "./admin.reports";

export const Route = createFileRoute("/administracion/reportes")({
  beforeLoad: () => requireAdminRoute("/administracion/reportes"),
  component: ReportsAdminPage,
});
