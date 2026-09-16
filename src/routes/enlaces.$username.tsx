import { createFileRoute } from "@tanstack/react-router";
import { PublicLinksPage } from "./links.$username";

export const Route = createFileRoute("/enlaces/$username")({
  component: PublicLinksPage,
});
