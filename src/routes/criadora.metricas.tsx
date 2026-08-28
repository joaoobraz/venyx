import { createFileRoute } from "@tanstack/react-router";
import { CreatorAnalyticsPage } from "./creator.analytics";

export const Route = createFileRoute("/criadora/metricas")({ component: CreatorAnalyticsPage });
