import { createFileRoute } from "@tanstack/react-router";
import { LoyaltyPage } from "./loyalty";

export const Route = createFileRoute("/fidelidade")({ component: LoyaltyPage });
