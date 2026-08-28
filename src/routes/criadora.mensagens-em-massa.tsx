import { createFileRoute } from "@tanstack/react-router";
import { MailingPage } from "./creator.mailing";

export const Route = createFileRoute("/criadora/mensagens-em-massa")({ component: MailingPage });
