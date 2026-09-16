import { createFileRoute } from "@tanstack/react-router";
import { MyRequestsPage } from "./requests";

export const Route = createFileRoute("/meus-pedidos")({ component: MyRequestsPage });
