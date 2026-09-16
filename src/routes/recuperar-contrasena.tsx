import { createFileRoute } from "@tanstack/react-router";
import { ResetPage } from "./reset-password";

export const Route = createFileRoute("/recuperar-contrasena")({ component: ResetPage });
