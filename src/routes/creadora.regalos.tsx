import { createFileRoute } from "@tanstack/react-router";
import { CreatorGiftsPage } from "./creator.gifts";

export const Route = createFileRoute("/creadora/regalos")({ component: CreatorGiftsPage });
