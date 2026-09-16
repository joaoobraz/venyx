import { createFileRoute } from "@tanstack/react-router";
import { CreatorPostsPage } from "./creator.posts";

export const Route = createFileRoute("/creadora/publicaciones")({ component: CreatorPostsPage });
