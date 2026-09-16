import { createFileRoute } from "@tanstack/react-router";
import { SignupPage } from "./signup";

export const Route = createFileRoute("/registro")({ component: SignupPage });
