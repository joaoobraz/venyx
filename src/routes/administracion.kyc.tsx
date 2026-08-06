import { createFileRoute } from "@tanstack/react-router";
import { requireAdminRoute } from "@/lib/admin-route-guard";
import { AdminKycPage } from "./admin.kyc";

export const Route = createFileRoute("/administracion/kyc")({
  beforeLoad: () => requireAdminRoute("/administracion/kyc"),
  component: AdminKycPage,
});
