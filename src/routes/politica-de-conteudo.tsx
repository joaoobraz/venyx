import { createFileRoute } from "@tanstack/react-router";
import { ContentPolicyPage } from "./content-policy";

export const Route = createFileRoute("/politica-de-conteudo")({
  component: ContentPolicyPage,
});
