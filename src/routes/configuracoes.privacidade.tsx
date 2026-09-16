import { createFileRoute } from "@tanstack/react-router";
import { PrivacySettingsPage } from "./settings.privacy";

export const Route = createFileRoute("/configuracoes/privacidade")({ component: PrivacySettingsPage });
