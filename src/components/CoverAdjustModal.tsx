import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Move } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";

/** Mesma proporção usada na faixa de capa do perfil público. */
const ASPECT = 3;
const OUTPUT_WIDTH = 1500;

type Geometry = { frameW: number; frameH: number; dispW: number; dispH: number };

function geometryFor(image: HTMLImageElement, frameW: number, zoom: number): Geometry {
  const frameH = frameW / ASPECT;
  const baseScale = Math.max(frameW / image.naturalWidth, frameH / image.naturalHeight);
  const scale = baseScale * zoom;
  return {
    frameW,
    frameH,
    dispW: image.naturalWidth * scale,
    dispH: image.naturalHeight * scale,
  };
}

function clampOffset(offset: { x: number; y: number }, g: Geometry) {
  return {
    x: Math.min(0, Math.max(g.frameW - g.dispW, offset.x)),
    y: Math.min(0, Math.max(g.frameH - g.dispH, offset.y)),
  };
}

export function CoverAdjustModal({
  file,
  onCancel,
  onConfirm,
}: {
  file: File | null;
  onCancel: () => void;
  onConfirm: (blob: Blob) => Promise<void> | void;
}) {
  const { tr } = useI18n();
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerX: number; pointerY: number; offsetX: number; offsetY: number } | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [frameW, setFrameW] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);

  // Carrega o arquivo escolhido e centraliza o enquadramento inicial.
  useEffect(() => {
    if (!file) {
      setImage(null);
      return;
    }
    const url = URL.createObjectURL(file);
    const loaded = new Image();
    loaded.onload = () => {
      setImage(loaded);
      setZoom(1);
    };
    loaded.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const measure = useCallback(() => {
    if (frameRef.current) setFrameW(frameRef.current.clientWidth);
  }, []);

  useEffect(() => {
    if (!image) return;
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [image, measure]);

  // Recentraliza sempre que a imagem, o zoom ou a largura do quadro mudam.
  useEffect(() => {
    if (!image || !frameW) return;
    const g = geometryFor(image, frameW, zoom);
    setOffset((current) =>
      clampOffset(
        current.x === 0 && current.y === 0
          ? { x: (g.frameW - g.dispW) / 2, y: (g.frameH - g.dispH) / 2 }
          : current,
        g,
      ),
    );
  }, [image, frameW, zoom]);

  const geometry = image && frameW ? geometryFor(image, frameW, zoom) : null;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!geometry) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || !geometry) return;
    setOffset(
      clampOffset(
        {
          x: drag.offsetX + (e.clientX - drag.pointerX),
          y: drag.offsetY + (e.clientY - drag.pointerY),
        },
        geometry,
      ),
    );
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const confirm = async () => {
    if (!image || !geometry) return;
    setSaving(true);
    try {
      const k = OUTPUT_WIDTH / geometry.frameW;
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_WIDTH;
      canvas.height = Math.round(OUTPUT_WIDTH / ASPECT);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas");
      ctx.drawImage(image, offset.x * k, offset.y * k, geometry.dispW * k, geometry.dispH * k);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.9),
      );
      if (!blob) throw new Error("blob");
      await onConfirm(blob);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(file)} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{tr("Ajuste a foto de capa", "Adjust your cover photo")}</DialogTitle>
        </DialogHeader>

        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Move className="h-4 w-4 shrink-0" />
          {tr(
            "Arraste a imagem para escolher a parte que aparece.",
            "Drag the image to choose the visible area.",
          )}
        </p>

        <div
          ref={frameRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className="relative w-full cursor-grab touch-none select-none overflow-hidden rounded-xl bg-muted active:cursor-grabbing"
          style={{ aspectRatio: `${ASPECT}` }}
        >
          {image && geometry && (
            <img
              src={image.src}
              alt=""
              draggable={false}
              className="pointer-events-none absolute left-0 top-0 max-w-none"
              style={{
                width: `${geometry.dispW}px`,
                height: `${geometry.dispH}px`,
                transform: `translate(${offset.x}px, ${offset.y}px)`,
              }}
            />
          )}
        </div>

        <div>
          <Label htmlFor="cover-zoom" className="text-sm">
            {tr("Zoom", "Zoom")}: {Math.round(zoom * 100)}%
          </Label>
          <input
            id="cover-zoom"
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="mt-2 w-full accent-primary"
          />
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={saving}>
            {tr("Cancelar", "Cancel")}
          </Button>
          <Button
            className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={confirm}
            disabled={saving || !image}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : tr("Salvar capa", "Save cover")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
