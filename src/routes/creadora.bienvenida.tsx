import { createFileRoute } from "@tanstack/react-router";
import { CreatorWelcomePage } from "./creator.welcome";

export const Route = createFileRoute("/creadora/bienvenida")({ component: CreatorWelcomePage });
