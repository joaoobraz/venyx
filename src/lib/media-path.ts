/**
 * Regra única de "dono do caminho" da mídia, espelhada na função SQL
 * public.media_path_belongs_to. Um caminho só pode ser assinado se começar
 * com o id do dono (criadora do post, autora do story, remetente do chat).
 */
export function isOwnedMediaPath(ownerId: string | null | undefined, path: string | null | undefined): boolean {
  if (!ownerId || !path) return false;
  if (path.length > 500) return false;
  if (path.includes("..")) return false;
  return path.startsWith(`${ownerId}/`) && path.length > ownerId.length + 1;
}
