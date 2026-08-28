import { createFileRoute } from "@tanstack/react-router";
import { NotifPage } from "./notifications";

export const Route = createFileRoute("/notificaciones")({ component: NotifPage });
