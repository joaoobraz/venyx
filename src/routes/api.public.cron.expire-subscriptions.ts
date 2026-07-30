import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { secretsMatch, unauthorizedResponse } from "@/_server/secrets.server";

export const Route = createFileRoute("/api/public/cron/expire-subscriptions")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = request.headers.get("x-cron-secret");
        const expected = process.env.CRON_SECRET;
        if (!secretsMatch(secret, expected)) {
          return unauthorizedResponse();
        }
        const { data, error } = await supabaseAdmin.rpc("expire_due_subscriptions");
        if (error) {
          console.error("[cron expire-subs] error:", error);
          return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }
        return Response.json({ ok: true, result: data });
      },
    },
  },
});
