import { redirect } from "@tanstack/react-router";
import { requireAdminServer } from "@/_server/admin.functions";

export async function requireAdminRoute(path: string) {
  try {
    await requireAdminServer({ data: { path } });
  } catch {
    throw redirect({ to: "/403" });
  }
}
