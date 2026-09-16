import { createFileRoute } from "@tanstack/react-router";
import { requireAdminRoute } from "@/lib/admin-route-guard";
import { AdminKycPage } from "./admin.kyc";

export const Route = createFileRoute("/administracao/kyc")({
  beforeLoad: () => requireAdminRoute("/administracao/kyc"),
  component: AdminKycPage,
});
