import { createFileRoute } from "@tanstack/react-router";
import { CreatorRequestsPage } from "./creator.requests";

export const Route = createFileRoute("/criadora/pedidos")({ component: CreatorRequestsPage });
