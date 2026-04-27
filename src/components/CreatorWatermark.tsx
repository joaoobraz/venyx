import { type ReactNode } from "react";

export type WatermarkPosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "center";

interface Props {
  username: string;
  position?: WatermarkPosition;
  opacity?: number;
  children: ReactNode;
}

function getPositionClasses(pos: WatermarkPosition): string {
  switch (pos) {
    case "top-left":
      return "top-2 left-2";
    case "top-right":
      return "top-2 right-2";
    case "bottom-left":
      return "bottom-2 left-2";
    case "center":
      return "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2";
    case "bottom-right":
    default:
      return "bottom-2 right-2";
  }
}

function getSiteDomain(): string {
  if (typeof window === "undefined") return "site";
  return window.location.hostname.replace(/^www\./, "");
}

/**
 * Marca d'água aplicada sobre toda mídia enviada por uma criadora.
 * Formato: {dominio}/@{username}
 */
export function CreatorWatermark({
  username,
  position = "bottom-right",
  opacity = 0.6,
  children,
}: Props) {
  const domain = getSiteDomain();
  const text = `${domain}/@${username}`;
  const clamped = Math.min(1, Math.max(0.1, opacity));

  return (
    <div className="relative">
      {children}
      <div
        aria-hidden
        className={`pointer-events-none absolute z-10 select-none rounded-md bg-black/40 px-2 py-1 text-[11px] font-semibold text-white shadow-md ${getPositionClasses(
          position,
        )}`}
        style={{
          opacity: clamped,
          textShadow: "0 1px 2px rgba(0,0,0,0.6)",
          mixBlendMode: "normal",
        }}
      >
        {text}
      </div>
    </div>
  );
}
