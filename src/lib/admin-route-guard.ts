import { redirect } from "@tanstack/react-router";
import { requireAdminServer } from "@/_server/admin.functions";

export async function requireAdminRoute(path: string) {
  // O guard só faz sentido no navegador; no SSR não há sessão no pedido.
  if (typeof window === "undefined") return;
  try {
    await requireAdminServer({ data: { path } });
  } catch {
    throw redirect({ to: "/403" });
  }
}
