import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";

/**
 * Hash curto e estável (não-criptográfico) — djb2 — só pra "assinatura visível"
 * que liga o frame ao viewer. Não usar para autenticação.
 */
function shortHash(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h) ^ input.charCodeAt(i);
  }
  // 6 caracteres base36, sempre positivo
  return (h >>> 0).toString(36).slice(0, 6).toUpperCase().padStart(6, "0");
}

function formatStamp(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Renderiza imagem ou vídeo com marca d'água dinâmica visível contendo:
 *   @username • UID(8) • data/hora • assinatura(6)
 *
 * - Repetida em diagonal cobrindo todo o frame para sobreviver a recortes.
 * - Para vídeos: stamp e assinatura são re-gerados a cada minuto, garantindo
 *   que prints feitos em momentos diferentes tenham assinaturas distintas.
 * - O hash é derivado de userId + minuto atual + src, então cada viewer/frame
 *   produz uma marca única, rastreável até a origem do vazamento.
 *
 * IMPORTANTE: marca d'água visível é dissuasão e atribuição.
 * NÃO substitui DRM/HLS-AES nem URLs assinadas curtas no servidor.
 */
export function WatermarkedMedia({
  src,
  mime,
  className,
  enabled = true,
}: {
  src: string;
  mime: string;
  className?: string;
  enabled?: boolean;
}) {
  const { user, profile } = useAuth();

  const isVideo = mime.startsWith("video/");

  // Tick a cada 60s só para vídeos (atualiza stamp/hash em playback longo).
  // Para imagens, fixamos no mount: print único = assinatura única daquela visualização.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!isVideo || !enabled) return;
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, [isVideo, enabled]);

  const stamp = useMemo(() => {
    const now = new Date();
    const dateStr = formatStamp(now);
    const uidShort = (user?.id ?? "anon").replace(/-/g, "").slice(0, 8).toUpperCase();
    const handle = profile?.username ? `@${profile.username}` : "guest";
    // Assinatura curta atrelada a viewer + minuto + recurso
    const sig = shortHash(`${user?.id ?? "anon"}|${dateStr}|${src}`);
    return { dateStr, uidShort, handle, sig };
    // tick força recompute em vídeos
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profile?.username, src, tick]);

  const tag = `${stamp.handle} • ${stamp.uidShort} • ${stamp.dateStr} • ${stamp.sig}`;

  const Media = isVideo ? (
    <video
      src={src}
      controls
      className={className}
      controlsList="nodownload noremoteplayback"
      disablePictureInPicture
      onContextMenu={(e) => e.preventDefault()}
    />
  ) : (
    <img
      src={src}
      alt=""
      className={className}
      draggable={false}
      onContextMenu={(e) => e.preventDefault()}
    />
  );

  if (!enabled) return Media;

  return (
    <div className="relative isolate protected-media overflow-hidden">
      {Media}

      {/* Camada de tiles diagonais cobrindo todo o frame */}
      <div
        className="pointer-events-none absolute inset-0 select-none overflow-hidden"
        aria-hidden
      >
        <div
          className="absolute -inset-1/2 flex flex-wrap content-start gap-x-10 gap-y-8"
          style={{ transform: "rotate(-28deg)" }}
        >
          {Array.from({ length: 80 }).map((_, i) => (
            <span
              key={i}
              className="text-[10px] font-semibold whitespace-nowrap"
              style={{
                color: "rgba(255,255,255,0.18)",
                textShadow:
                  "0 1px 2px rgba(0,0,0,0.55), 0 0 1px rgba(0,0,0,0.7)",
                mixBlendMode: "difference",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Selo de canto inferior-direito, mais visível, para print "limpo" */}
      <div
        className="pointer-events-none absolute bottom-1.5 right-1.5 select-none"
        aria-hidden
      >
        <span
          className="rounded-sm px-1.5 py-0.5 text-[9px] font-semibold tracking-wider"
          style={{
            color: "rgba(255,255,255,0.85)",
            background: "rgba(0,0,0,0.35)",
            backdropFilter: "blur(2px)",
            textShadow: "0 1px 2px rgba(0,0,0,0.6)",
          }}
        >
          {stamp.handle} · {stamp.uidShort} · {stamp.sig}
        </span>
      </div>
    </div>
  );
}
