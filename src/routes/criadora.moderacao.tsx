import { createFileRoute } from "@tanstack/react-router";
import { CreatorModerationPage } from "./creator.moderation";

export const Route = createFileRoute("/criadora/moderacao")({ component: CreatorModerationPage });
