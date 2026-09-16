import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Localiza o id de um usuário pelo e-mail (API administrativa, paginada). */
export async function findUserIdByEmail(email: string): Promise<string | null> {
  const target = email.trim().toLowerCase();
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      console.error("[auth-admin.listUsers]", error.message);
      return null;
    }
    const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (hit) return hit.id;
    if (data.users.length < 1000) break;
  }
  return null;
}

/**
 * Grava o idioma atual nos metadados da conta para o template de e-mail do
 * Supabase ({{ .Data.locale }}) sair no idioma que a pessoa está usando.
 */
export async function setUserLocale(userId: string, locale: string): Promise<void> {
  const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
  const current = (data?.user?.user_metadata ?? {}) as Record<string, unknown>;
  if (current.locale === locale) return;
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    user_metadata: { ...current, locale },
  });
  if (error) console.error("[auth-admin.setUserLocale]", error.message);
}
