import { createFileRoute } from "@tanstack/react-router";
import { requireAdminRoute } from "@/lib/admin-route-guard";
import { AdminOperationsPage } from "./admin.operations";

export const Route = createFileRoute("/administracion/operaciones")({
  beforeLoad: () => requireAdminRoute("/administracion/operaciones"),
  component: AdminOperationsPage,
});
