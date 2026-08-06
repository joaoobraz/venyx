import { useEffect, useState, type SyntheticEvent } from "react";
import { cn } from "@/lib/utils";
import { classifyProductImageOrientation, type ProductImageOrientation } from "@/lib/product-image";

export function GiftProductImage({
  src,
  alt,
  emoji = "🎁",
  className,
}: {
  src?: string | null;
  alt: string;
  emoji?: string;
  className?: string;
}) {
  const [orientation, setOrientation] = useState<ProductImageOrientation>("portrait");

  useEffect(() => setOrientation("portrait"), [src]);

  const detectOrientation = (event: SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    setOrientation(classifyProductImageOrientation(image.naturalWidth, image.naturalHeight));
  };

  return (
    <div
      className={cn("relative isolate overflow-hidden bg-primary/10", className)}
      data-image-orientation={orientation}
    >
      {src ? (
        <>
          <img
            src={src}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-45 blur-xl"
          />
          <div className="absolute inset-0 bg-background/15" />
          <img
            src={src}
            alt={alt}
            onLoad={detectOrientation}
            className={cn(
              "relative z-10 h-full w-full transition duration-300",
              orientation === "landscape" ? "object-cover" : "object-contain",
            )}
          />
        </>
      ) : (
        <div className="flex h-full w-full items-center justify-center text-5xl">{emoji}</div>
      )}
    </div>
  );
}
