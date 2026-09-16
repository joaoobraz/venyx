import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Envia a mensagem automática de boas-vindas da criadora ao novo assinante,
 * logo após a assinatura ser ativada. Roda com service role (a criadora não
 * está online). Idempotente por thread: nunca manda duas boas-vindas para o
 * mesmo fã. Falhas são só logadas — jamais quebram a ativação da assinatura.
 */
export async function sendWelcomeMessage(creatorId: string, subscriberId: string) {
  try {
    if (creatorId === subscriberId) return;
    const { data: template } = await supabaseAdmin
      .from("creator_welcome_messages" as never)
      .select("enabled, body, media_path, mime_type, ppv_price_cents")
      .eq("creator_id", creatorId)
      .maybeSingle();
    const tpl = template as unknown as {
      enabled: boolean;
      body: string;
      media_path: string | null;
      mime_type: string | null;
      ppv_price_cents: number;
    } | null;
    if (!tpl || !tpl.enabled) return;
    if (!tpl.body.trim() && !tpl.media_path) return;

    const { data: blocked } = await supabaseAdmin.rpc("users_are_blocked", {
      _user_a: creatorId,
      _user_b: subscriberId,
    });
    if (blocked) return;

    const [userA, userB] = [creatorId, subscriberId].sort();
    let { data: thread } = await supabaseAdmin
      .from("chat_threads")
      .select("id")
      .eq("user_a", userA)
      .eq("user_b", userB)
      .maybeSingle();
    if (!thread) {
      const { data: created, error } = await supabaseAdmin
        .from("chat_threads")
        .insert({ user_a: userA, user_b: userB })
        .select("id")
        .single();
      if (error) {
        // Corrida com o cliente criando a mesma thread: relê.
        const { data: again } = await supabaseAdmin
          .from("chat_threads")
          .select("id")
          .eq("user_a", userA)
          .eq("user_b", userB)
          .maybeSingle();
        thread = again;
      } else {
        thread = created;
      }
    }
    if (!thread) return;

    const { data: already } = await supabaseAdmin
      .from("chat_messages")
      .select("id")
      .eq("thread_id", thread.id)
      .eq("sender_id", creatorId)
      .eq("message_kind", "welcome")
      .limit(1)
      .maybeSingle();
    if (already) return;

    // Mídia respeita a chave de moderação manual; texto puro entra aprovado.
    let moderation: "approved" | "pending" = "approved";
    if (tpl.media_path) {
      const { data: manual } = await supabaseAdmin.rpc("get_manual_moderation_enabled" as never);
      moderation = manual ? "pending" : "approved";
    }

    const { error: insertError } = await supabaseAdmin.from("chat_messages").insert({
      thread_id: thread.id,
      sender_id: creatorId,
      body: tpl.body.trim() || null,
      media_path: tpl.media_path,
      mime_type: tpl.media_path ? tpl.mime_type : null,
      ppv_price_cents: tpl.media_path ? tpl.ppv_price_cents : 0,
      subscribers_only: false,
      message_kind: "welcome",
      moderation_status: moderation,
    } as never);
    if (insertError) {
      console.error("[welcome] insert falhou", insertError.code, insertError.message);
      return;
    }
    await supabaseAdmin
      .from("chat_threads")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", thread.id);
  } catch (error) {
    console.error("[welcome] erro inesperado", error instanceof Error ? error.message : error);
  }
}
