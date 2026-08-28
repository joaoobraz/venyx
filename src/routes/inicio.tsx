import { createFileRoute } from "@tanstack/react-router";
import { FeedPage } from "./feed";

export const Route = createFileRoute("/inicio")({ component: FeedPage });
