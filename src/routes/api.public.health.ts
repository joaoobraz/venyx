import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const HEALTH_TIMEOUT_MS = 5_000;

function response(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        const startedAt = Date.now();
        try {
          const supabaseUrl = process.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
          const publishableKey =
            process.env.SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

          if (!supabaseUrl || !publishableKey) {
            throw new Error("health_configuration_missing");
          }

          const healthClient = createClient<Database>(supabaseUrl, publishableKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          });
          const databaseCheck = healthClient
            .from("profiles")
            .select("user_id", { head: true, count: "exact" })
            .limit(1);
          const timeout = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error("health_timeout")), HEALTH_TIMEOUT_MS);
          });
          const { error } = await Promise.race([databaseCheck, timeout]);
          if (error) throw error;

          return response(
            {
              status: "ok",
              service: "fanlira",
              database: "ok",
              responseMs: Date.now() - startedAt,
            },
            200,
          );
        } catch (error) {
          console.error(
            "[health] dependency check failed",
            error instanceof Error ? error.name : "unknown",
          );
          return response(
            {
              status: "degraded",
              service: "fanlira",
              database: "unavailable",
              responseMs: Date.now() - startedAt,
            },
            503,
          );
        }
      },
    },
  },
});
