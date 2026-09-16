import { createFileRoute } from "@tanstack/react-router";
import { PaymentsPage } from "./settings.payments";

export const Route = createFileRoute("/configuracoes/pagamentos")({ component: PaymentsPage });
