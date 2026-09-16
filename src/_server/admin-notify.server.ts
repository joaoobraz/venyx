import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";

/**
 * Avisa todas as contas com papel admin pela central de notificações do
 * próprio site. Usado para filas que precisam de revisão manual (KYC,
 * verificação de identidade, denúncias, etc.).
 */
export async function notifyAdmins(
  type: string,
  title: string,
  body: string,
  link: string,
  metadata: { [key: string]: Json | undefined } = {},
) {
  try {
    const { data: admins, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    if (error || !admins?.length) return;

    await supabaseAdmin.from("notifications").insert(
      admins.map((admin) => ({
        user_id: admin.user_id,
        type,
        title,
        body,
        link,
        metadata,
      })),
    );
  } catch (e) {
    console.error("[admin-notify]", e);
  }
}
