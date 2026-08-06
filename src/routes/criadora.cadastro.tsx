import { createFileRoute } from "@tanstack/react-router";
import { CreatorOnboardingPage } from "./creator.onboarding";

export const Route = createFileRoute("/criadora/cadastro")({ component: CreatorOnboardingPage });
