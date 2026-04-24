import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Endpoint chamado por pg_cron a cada minuto.
 * Processa um lote (até 50) de jobs pendentes da fila de mailing em massa.
 */
export const Route = createFileRoute("/api/public/hooks/process-mailing-queue")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const { data, error } = await supabaseAdmin.rpc("process_mass_dm_batch", {
            _limit: 50,
          });
          if (error) {
            return new Response(JSON.stringify({ ok: false, error: error.message }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }
          return new Response(
            JSON.stringify({ ok: true, result: data?.[0] ?? { processed: 0, sent: 0, failed: 0 } }),
            { headers: { "Content-Type": "application/json" } }
          );
        } catch (e: any) {
          return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
      GET: async () => {
        return new Response(
          JSON.stringify({ ok: true, info: "POST to process queue" }),
          { headers: { "Content-Type": "application/json" } }
        );
      },
    },
  },
});
