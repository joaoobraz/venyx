import { createFileRoute } from "@tanstack/react-router";
import { MyRequestsPage } from "./requests";

export const Route = createFileRoute("/mis-pedidos")({ component: MyRequestsPage });
