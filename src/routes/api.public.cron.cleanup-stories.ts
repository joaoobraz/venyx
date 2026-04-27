import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/cron/cleanup-stories")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = request.headers.get("x-cron-secret");
        const expected = process.env.CRON_SECRET;
        if (!expected || secret !== expected) {
          return new Response("unauthorized", { status: 401 });
        }
        const { data, error } = await supabaseAdmin.rpc("cleanup_expired_stories");
        if (error) {
          console.error("[cron cleanup-stories] error:", error);
          return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }
        // data é um array tipo [{ deleted_paths: ["path1", "path2"] }]
        const paths: string[] = Array.isArray(data) && data[0]?.deleted_paths ? data[0].deleted_paths : [];
        let removedFromStorage = 0;
        if (paths.length > 0) {
          const { error: rmErr } = await supabaseAdmin.storage.from("stories").remove(paths);
          if (rmErr) {
            console.error("[cron cleanup-stories] storage error:", rmErr);
          } else {
            removedFromStorage = paths.length;
          }
        }
        return Response.json({ ok: true, db_deleted: paths.length, storage_deleted: removedFromStorage });
      },
    },
  },
});
