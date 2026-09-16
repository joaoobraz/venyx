import { createFileRoute } from "@tanstack/react-router";
import { requireAdminRoute } from "@/lib/admin-route-guard";
import { AdminHomePage } from "./admin.index";

export const Route = createFileRoute("/administracion/")({
  beforeLoad: () => requireAdminRoute("/administracion"),
  component: AdminHomePage,
});
