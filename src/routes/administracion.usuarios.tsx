import { createFileRoute } from "@tanstack/react-router";
import { requireAdminRoute } from "@/lib/admin-route-guard";
import { AdminUsersPage } from "./admin.users";

export const Route = createFileRoute("/administracion/usuarios")({
  beforeLoad: () => requireAdminRoute("/administracion/usuarios"),
  component: AdminUsersPage,
});
