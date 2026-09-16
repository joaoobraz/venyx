import { createFileRoute } from "@tanstack/react-router";
import { CreatorLinksPage } from "./creator.links";

export const Route = createFileRoute("/criadora/links")({ component: CreatorLinksPage });
