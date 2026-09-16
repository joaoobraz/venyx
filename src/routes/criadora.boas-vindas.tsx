import { createFileRoute } from "@tanstack/react-router";
import { CreatorWelcomePage } from "./creator.welcome";

export const Route = createFileRoute("/criadora/boas-vindas")({ component: CreatorWelcomePage });
