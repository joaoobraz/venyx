import { createFileRoute } from "@tanstack/react-router";
import { SavedPostPage } from "./saved.$postId";

export const Route = createFileRoute("/guardado/$postId")({
  component: SavedPostPage,
});
