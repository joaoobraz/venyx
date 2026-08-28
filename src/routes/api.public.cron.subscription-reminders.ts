import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { secretsMatch, unauthorizedResponse } from "@/_server/secrets.server";

export const Route = createFileRoute("/api/public/cron/subscription-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = request.headers.get("x-cron-secret");
        if (!secretsMatch(secret, process.env.CRON_SECRET)) {
          return unauthorizedResponse();
        }

        const { data, error } = await supabaseAdmin.rpc(
          "dispatch_subscription_renewal_reminders",
        );
        if (error) {
          console.error("[cron subscription-reminders] failed", error.code);
          return Response.json({ ok: false, error: "reminder_dispatch_failed" }, { status: 500 });
        }

        return Response.json({ ok: true, reminders: data ?? 0 });
      },
    },
  },
});
