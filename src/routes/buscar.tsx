import { createFileRoute } from "@tanstack/react-router";
import { SearchPage, searchRouteSearchValidator } from "./search";

export const Route = createFileRoute("/buscar")({
  validateSearch: searchRouteSearchValidator,
  component: SearchPage,
});
