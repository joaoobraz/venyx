import { createFileRoute } from "@tanstack/react-router";
import {
  reconcilePendingPixCharges,
  ReconciliationConfigurationError,
} from "@/_server/payment-reconciliation.server";
import { secretsMatch, unauthorizedResponse } from "@/_server/secrets.server";

export const Route = createFileRoute("/api/public/cron/reconcile-pix")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!secretsMatch(request.headers.get("x-cron-secret"), process.env.CRON_SECRET)) {
          return unauthorizedResponse();
        }
        try {
          const summary = await reconcilePendingPixCharges({ source: "cron", limit: 100 });
          return Response.json(summary);
        } catch (error) {
          const configurationError = error instanceof ReconciliationConfigurationError;
          console.error(
            "[cron reconcile-pix] failed",
            configurationError ? error.code : error instanceof Error ? error.message : "unknown",
          );
          return Response.json(
            { ok: false, error: configurationError ? error.code : "RECONCILIATION_FAILED" },
            { status: configurationError ? 503 : 500 },
          );
        }
      },
    },
  },
});
