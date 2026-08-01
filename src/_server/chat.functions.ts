import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdultVerification } from "@/_server/access-control.server";
import { detectExternalContact } from "@/lib/contact-guard";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SendMessageSchema = z.object({
  threadId: z.string().uuid(),
  body: z.string().trim().min(1).max(2000),
});

const EditMessageSchema = z.object({
  messageId: z.string().uuid(),
  body: z.string().trim().min(1).max(2000),
});

export const sendChatMessage = createServerFn({ method: "POST" })
  .middleware([requireAdultVerification])
  .validator((input: unknown) => SendMessageSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const body = data.body.trim();
    const detection = detectExternalContact(body);
    if (detection.blocked) {
      await supabase.from("moderation_logs").insert({
        user_id: userId,
        surface: "chat",
        category: "contact_share",
        reason: detection.matches
          .map((match) => `${match.label}: ${match.sample}`)
          .join(" | ")
          .slice(0, 500),
      });
      throw new Error(
        "Mensagem bloqueada: mantenha contatos, conversas e pagamentos dentro da Venyx.",
      );
    }

    const { data: thread, error: threadError } = await supabase
      .from("chat_threads")
      .select("id, user_a, user_b")
      .eq("id", data.threadId)
      .maybeSingle();
    if (
      threadError ||
      !thread ||
      (thread.user_a !== userId && thread.user_b !== userId)
    ) {
      throw new Error("Conversa não encontrada ou sem permissão.");
    }

    const [{ count: recentCount }, { data: duplicate }] = await Promise.all([
      supabase
        .from("chat_messages")
        .select("*", { count: "exact", head: true })
        .eq("thread_id", data.threadId)
        .eq("sender_id", userId)
        .gte("created_at", new Date(Date.now() - 60_000).toISOString()),
      supabase
        .from("chat_messages")
        .select("id")
        .eq("thread_id", data.threadId)
        .eq("sender_id", userId)
        .eq("body", body)
        .gte("created_at", new Date(Date.now() - 30_000).toISOString())
        .limit(1)
        .maybeSingle(),
    ]);
    if ((recentCount ?? 0) >= 20) {
      throw new Error("Muitas mensagens em pouco tempo. Aguarde alguns segundos.");
    }
    if (duplicate) throw new Error("Esta mensagem já foi enviada.");

    const { data: message, error } = await supabase
      .from("chat_messages")
      .insert({
        thread_id: data.threadId,
        sender_id: userId,
        body,
      })
      .select(
        "id, thread_id, sender_id, body, media_path, mime_type, ppv_price_cents, subscribers_only, read_at, edited_at, created_at",
      )
      .single();
    if (error) throw new Error(error.message);

    return {
      message: {
        ...message,
        unlocked: true,
      },
    };
  });

export const editChatMessage = createServerFn({ method: "POST" })
  .middleware([requireAdultVerification])
  .validator((input: unknown) => EditMessageSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const body = data.body.trim();
    const detection = detectExternalContact(body);
    if (detection.blocked) {
      await supabase.from("moderation_logs").insert({
        user_id: userId,
        surface: "chat",
        category: "contact_share",
        reason: detection.matches
          .map((match) => `${match.label}: ${match.sample}`)
          .join(" | ")
          .slice(0, 500),
      });
      throw new Error(
        "Mensagem bloqueada: mantenha contatos, conversas e pagamentos dentro da Venyx.",
      );
    }

    const { data: current, error: lookupError } = await supabase
      .from("chat_messages")
      .select(
        "id, thread_id, sender_id, body, media_path, mime_type, ppv_price_cents, subscribers_only, read_at, edited_at, created_at",
      )
      .eq("id", data.messageId)
      .maybeSingle();
    if (lookupError || !current || current.sender_id !== userId) {
      throw new Error("Mensagem não encontrada ou sem permissão.");
    }
    if (current.media_path) {
      throw new Error("Mensagens com mídia não podem ser editadas.");
    }
    if (Date.now() - new Date(current.created_at).getTime() > 15 * 60_000) {
      throw new Error("O prazo de 15 minutos para editar esta mensagem terminou.");
    }
    if (current.body === body) {
      return {
        message: {
          ...current,
          body,
          unlocked: true,
        },
      };
    }

    const editedAt = new Date().toISOString();
    const { data: message, error } = await supabaseAdmin
      .from("chat_messages")
      .update({ body, edited_at: editedAt })
      .eq("id", current.id)
      .eq("sender_id", userId)
      .select(
        "id, thread_id, sender_id, body, media_path, mime_type, ppv_price_cents, subscribers_only, read_at, edited_at, created_at",
      )
      .single();
    if (error) throw new Error(error.message);

    return {
      message: {
        ...message,
        unlocked: true,
      },
    };
  });
