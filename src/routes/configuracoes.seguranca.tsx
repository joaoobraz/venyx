import { createFileRoute } from "@tanstack/react-router";
import { SecurityPage } from "./settings.security";

export const Route = createFileRoute("/configuracoes/seguranca")({ component: SecurityPage });
