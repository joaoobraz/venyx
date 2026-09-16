import { createFileRoute } from "@tanstack/react-router";
import { HelpPage } from "./help";

export const Route = createFileRoute("/ajuda")({ component: HelpPage });
