import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { pausedAccountIds } from "@/_server/account-pause.server";

/**
 * Descoberta / busca pública de criadoras.
 * Usa o cliente admin no servidor e retorna SOMENTE campos públicos de perfil
 * de quem tem o papel 'creator'. Não expõe dados sensíveis.
 */

const searchSchema = z.object({
  query: z.string().trim().max(100).optional().default(""),
  sort: z.enum(["top", "new"]).optional().default("top"),
  limit: z.number().int().min(1).max(50).optional().default(24),
});

export interface CreatorResult {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  is_verified: boolean;
  subscription_price_cents: number | null;
}

export const searchCreators = createServerFn({ method: "POST" })
  .validator((input: unknown) => searchSchema.parse(input))
  .handler(async ({ data }): Promise<{ creators: CreatorResult[] }> => {
    // 1) ids de quem é criadora
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "creator");
    const creatorIds = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
    const pausedIds = await pausedAccountIds(creatorIds);
    const ids = creatorIds.filter((id) => !pausedIds.has(id));
    if (ids.length === 0) return { creators: [] };

    // 2) perfis públicos dessas criadoras
    let q = supabaseAdmin
      .from("profiles")
      .select(
        "user_id, username, display_name, avatar_url, cover_url, bio, is_verified, subscription_price_cents, created_at",
      )
      .in("user_id", ids);

    // 3) filtro de busca (username, nome ou bio) — sanitizado contra injeção de filtro
    const term = data.query.trim();
    if (term) {
      const safe = term.replace(/[%,()*\\]/g, " ").trim();
      if (safe) {
        q = q.or(`username.ilike.%${safe}%,display_name.ilike.%${safe}%,bio.ilike.%${safe}%`);
      }
    }

    // 4) ordenação
    q =
      data.sort === "new"
        ? q.order("created_at", { ascending: false })
        : q.order("is_verified", { ascending: false }).order("created_at", { ascending: false });

    const { data: profs, error } = await q.limit(data.limit);
    if (error) {
      console.error("[searchCreators]", error);
      return { creators: [] };
    }

    const creators: CreatorResult[] = (profs ?? []).map((p) => ({
      user_id: p.user_id,
      username: p.username,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      cover_url: p.cover_url,
      bio: p.bio,
      is_verified: p.is_verified,
      subscription_price_cents: p.subscription_price_cents,
    }));
    return { creators };
  });
