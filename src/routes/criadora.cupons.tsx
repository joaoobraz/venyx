import { createFileRoute } from "@tanstack/react-router";
import { CouponsPage } from "./creator.coupons";

export const Route = createFileRoute("/criadora/cupons")({ component: CouponsPage });
