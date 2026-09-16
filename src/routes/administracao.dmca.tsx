import { createFileRoute } from "@tanstack/react-router";
import { requireAdminRoute } from "@/lib/admin-route-guard";
import { AdminDmcaPage } from "./admin.dmca";

export const Route = createFileRoute("/administracao/dmca")({
  beforeLoad: () => requireAdminRoute("/administracao/dmca"),
  component: AdminDmcaPage,
});
