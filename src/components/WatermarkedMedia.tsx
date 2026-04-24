import { useAuth } from "@/lib/auth";

/**
 * Renderiza imagem ou vídeo com marca d'água visível (overlay de @username).
 * Para imagens: overlay diagonal repetido sobre o conteúdo.
 * Para vídeos: overlay HTML por cima — rastreável via screenshot.
 *
 * NOTA: a marca d'água visível inibe vazamento social (rastreia origem).
 * Watermark embutido no pixel exigiria pipeline server-side dedicado e
 * está planejado para uma 2ª fase.
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
  const { profile } = useAuth();
  const tag = profile?.username ? `@${profile.username} • venyx.app` : "venyx.app";

  const Media = mime.startsWith("video/") ? (
    <video src={src} controls className={className} />
  ) : (
    <img src={src} alt="" className={className} />
  );

  if (!enabled) return Media;

  return (
    <div className="relative isolate">
      {Media}
      <div
        className="pointer-events-none absolute inset-0 select-none"
        style={{
          backgroundImage: `repeating-linear-gradient(-30deg, transparent 0 80px, rgba(0,0,0,0.001) 80px 81px)`,
        }}
        aria-hidden
      >
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
          <div
            className="text-[11px] font-semibold text-white/30"
            style={{
              transform: "rotate(-30deg)",
              textShadow: "0 1px 4px rgba(0,0,0,0.5)",
              lineHeight: "70px",
              wordSpacing: "60px",
            }}
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i}>{`${tag}   ${tag}   ${tag}   ${tag}`}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
