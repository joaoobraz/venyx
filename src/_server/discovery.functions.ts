import { createServerFn } from "@tanstack/react-start";
import { clientIpKey, tryRateLimit } from "@/_server/rate-limit.server";
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
    if (!(await tryRateLimit(`search:ip:${clientIpKey()}`, 60, 60))) {
      throw new Error("Muitas buscas em pouco tempo. Aguarde um minuto.");
    }
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

const listSchema = z.object({
  limit: z.number().int().min(1).max(60).optional().default(30),
});

export interface PublicCreator {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  is_verified: boolean;
  score: number;
}

/**
 * Criadoras verificadas com plano ativo, ranqueadas por seguidores e curtidas.
 * Roda no servidor porque user_roles só é legível pelo próprio usuário (RLS):
 * consultar do navegador devolvia lista vazia em produção (Explorar e Top 15).
 */
export const listPublicCreators = createServerFn({ method: "POST" })
  .validator((input: unknown) => listSchema.parse(input ?? {}))
  .handler(async ({ data }): Promise<{ creators: PublicCreator[] }> => {
    if (!(await tryRateLimit(`discover:ip:${clientIpKey()}`, 120, 60))) {
      return { creators: [] };
    }
    const [{ data: roles }, { data: plans }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id").eq("role", "creator"),
      supabaseAdmin.from("subscription_plans").select("creator_id").eq("is_active", true),
    ]);
    const withPlan = new Set((plans ?? []).map((plan) => plan.creator_id));
    const creatorIds = Array.from(new Set((roles ?? []).map((role) => role.user_id))).filter((id) =>
      withPlan.has(id),
    );
    if (creatorIds.length === 0) return { creators: [] };
    const paused = await pausedAccountIds(creatorIds);
    const ids = creatorIds.filter((id) => !paused.has(id));
    if (ids.length === 0) return { creators: [] };

    const [{ data: profs }, { data: follows }, { data: posts }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("user_id, username, display_name, avatar_url, cover_url, is_verified")
        .in("user_id", ids)
        .eq("is_verified", true),
      supabaseAdmin.from("follows").select("followee_id").in("followee_id", ids),
      supabaseAdmin
        .from("posts")
        .select("creator_id, likes_count")
        .in("creator_id", ids)
        .eq("moderation_status", "approved"),
    ]);

    const followCount = new Map<string, number>();
    for (const row of follows ?? []) {
      followCount.set(row.followee_id, (followCount.get(row.followee_id) ?? 0) + 1);
    }
    const likesSum = new Map<string, number>();
    for (const row of posts ?? []) {
      likesSum.set(row.creator_id, (likesSum.get(row.creator_id) ?? 0) + (row.likes_count ?? 0));
    }

    const creators: PublicCreator[] = (profs ?? [])
      .map((p) => ({
        user_id: p.user_id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        cover_url: p.cover_url,
        is_verified: p.is_verified,
        score:
          (followCount.get(p.user_id) ?? 0) * 100 +
          (likesSum.get(p.user_id) ?? 0) +
          (p.is_verified ? 500 : 0),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, data.limit);
    return { creators };
  });
