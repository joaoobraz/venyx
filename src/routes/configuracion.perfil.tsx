import { createFileRoute } from "@tanstack/react-router";
import { SettingsProfile } from "./settings.profile";

export const Route = createFileRoute("/configuracion/perfil")({ component: SettingsProfile });
