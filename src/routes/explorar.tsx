import { createFileRoute } from "@tanstack/react-router";
import { ExplorePage } from "./explore";

export const Route = createFileRoute("/explorar")({ component: ExplorePage });
