import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/cron/process-mass-dm")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = request.headers.get("x-cron-secret");
        const expected = process.env.CRON_SECRET;
        if (!expected || secret !== expected) {
          return new Response("unauthorized", { status: 401 });
        }
        const { data, error } = await supabaseAdmin.rpc("process_mass_dm_batch", { _limit: 100 });
        if (error) {
          console.error("[cron mass-dm] error:", error);
          return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }
        return Response.json({ ok: true, result: data });
      },
    },
  },
});
