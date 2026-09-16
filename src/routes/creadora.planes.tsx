import { createFileRoute } from "@tanstack/react-router";
import { PlansPage } from "./creator.subscription-plans";

export const Route = createFileRoute("/creadora/planes")({ component: PlansPage });
