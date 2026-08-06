import { createFileRoute } from "@tanstack/react-router";
import { UpsellsPage } from "./creator.upsells";

export const Route = createFileRoute("/creadora/ofertas-adicionales")({ component: UpsellsPage });
