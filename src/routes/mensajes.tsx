import { createFileRoute } from "@tanstack/react-router";
import { ChatPage, chatSearchValidator } from "./chat";

export const Route = createFileRoute("/mensajes")({
  validateSearch: chatSearchValidator,
  component: ChatPage,
});
