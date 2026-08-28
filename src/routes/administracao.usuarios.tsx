import { createFileRoute } from "@tanstack/react-router";
import { requireAdminRoute } from "@/lib/admin-route-guard";
import { AdminUsersPage } from "./admin.users";

export const Route = createFileRoute("/administracao/usuarios")({
  beforeLoad: () => requireAdminRoute("/administracao/usuarios"),
  component: AdminUsersPage,
});
