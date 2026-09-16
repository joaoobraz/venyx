import { createFileRoute } from "@tanstack/react-router";
import { CreatorMediaLibraryPage } from "./creator.media-library";

export const Route = createFileRoute("/criadora/acervo")({ component: CreatorMediaLibraryPage });
