import { createFileRoute } from "@tanstack/react-router";
import { CreatorAnalyticsPage } from "./creator.analytics";

export const Route = createFileRoute("/creadora/metricas")({ component: CreatorAnalyticsPage });
