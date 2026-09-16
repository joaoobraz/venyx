import { createFileRoute } from "@tanstack/react-router";
import { DmcaPage } from "./creator.dmca";

export const Route = createFileRoute("/creadora/dmca")({ component: DmcaPage });
