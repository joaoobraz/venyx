import { createFileRoute } from "@tanstack/react-router";
import { MailingPage } from "./creator.mailing";

export const Route = createFileRoute("/creadora/mensajes-en-masa")({ component: MailingPage });
