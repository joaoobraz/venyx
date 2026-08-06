import { createFileRoute } from "@tanstack/react-router";
import { WalletPage } from "./creator.wallet";

export const Route = createFileRoute("/criadora/carteira")({ component: WalletPage });
