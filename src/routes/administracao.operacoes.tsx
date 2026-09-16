import { createFileRoute } from "@tanstack/react-router";
import { requireAdminRoute } from "@/lib/admin-route-guard";
import { AdminOperationsPage } from "./admin.operations";

export const Route = createFileRoute("/administracao/operacoes")({
  beforeLoad: () => requireAdminRoute("/administracao/operacoes"),
  component: AdminOperationsPage,
});
