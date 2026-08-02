import { createHash } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const schema = z
  .object({
    eventType: z.enum(["view", "click"]),
    creatorId: z.string().uuid(),
    linkId: z.string().uuid().optional(),
    anonymousId: z.string().uuid(),
  })
  .superRefine((value, ctx) => {
    if (value.eventType === "click" && !value.linkId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "linkId obrigatório" });
    }
    if (value.eventType === "view" && value.linkId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "linkId inválido" });
    }
  });

function ipOf(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export const Route = createFileRoute("/api/public/link-event")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const contentLength = Number(request.headers.get("content-length") ?? 0);
        if (contentLength > 4_096) return Response.json({ ok: false }, { status: 413 });

        let input: z.infer<typeof schema>;
        try {
          input = schema.parse(await request.json());
        } catch {
          return Response.json({ ok: false }, { status: 400 });
        }

        if (input.eventType === "view") {
          const { data: page } = await supabaseAdmin
            .from("creator_link_pages")
            .select("user_id")
            .eq("user_id", input.creatorId)
            .eq("is_published", true)
            .maybeSingle();
          if (!page) return Response.json({ ok: false }, { status: 404 });
        } else {
          const { data: link } = await supabaseAdmin
            .from("creator_links")
            .select("id")
            .eq("id", input.linkId!)
            .eq("user_id", input.creatorId)
            .eq("is_active", true)
            .maybeSingle();
          if (!link) return Response.json({ ok: false }, { status: 404 });
        }

        const salt = process.env.CRON_SECRET || "venyx-local-links";
        const visitorHash = createHash("sha256")
          .update(`${salt}:${ipOf(request)}:${input.anonymousId}`)
          .digest("hex");
        const { error } = await supabaseAdmin.from("creator_link_events").insert({
          page_owner_id: input.creatorId,
          link_id: input.linkId ?? null,
          event_type: input.eventType,
          visitor_hash: visitorHash,
        });
        if (error && error.code !== "23505") {
          console.error("[public-link-event]", error.code);
          return Response.json({ ok: false }, { status: 500 });
        }
        return Response.json({ ok: true }, { status: 202 });
      },
    },
  },
});
