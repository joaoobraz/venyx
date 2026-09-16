import { createFileRoute } from "@tanstack/react-router";
import { CreatorPostsPage } from "./creator.posts";

export const Route = createFileRoute("/criadora/publicacoes")({ component: CreatorPostsPage });
