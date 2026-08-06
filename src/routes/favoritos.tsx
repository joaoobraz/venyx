import { createFileRoute } from "@tanstack/react-router";
import { WishlistPage } from "./wishlist";

export const Route = createFileRoute("/favoritos")({ component: WishlistPage });
