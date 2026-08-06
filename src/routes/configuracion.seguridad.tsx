import { createFileRoute } from "@tanstack/react-router";
import { SecurityPage } from "./settings.security";

export const Route = createFileRoute("/configuracion/seguridad")({ component: SecurityPage });
