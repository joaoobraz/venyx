import { createFileRoute } from "@tanstack/react-router";
import { PaymentsPage } from "./settings.payments";

export const Route = createFileRoute("/configuracion/pagos")({ component: PaymentsPage });
