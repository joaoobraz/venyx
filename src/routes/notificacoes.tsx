import { createFileRoute } from "@tanstack/react-router";
import { NotifPage } from "./notifications";

export const Route = createFileRoute("/notificacoes")({ component: NotifPage });
