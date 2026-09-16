import { createFileRoute } from "@tanstack/react-router";
import { DmcaPage } from "./creator.dmca";

export const Route = createFileRoute("/criadora/dmca")({ component: DmcaPage });
