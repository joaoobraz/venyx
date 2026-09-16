export type ProductImageOrientation = "portrait" | "square" | "landscape";

export function classifyProductImageOrientation(
  naturalWidth: number,
  naturalHeight: number,
): ProductImageOrientation {
  if (naturalWidth <= 0 || naturalHeight <= 0) return "portrait";
  const ratio = naturalHeight / naturalWidth;
  if (ratio >= 1.08) return "portrait";
  if (ratio <= 0.92) return "landscape";
  return "square";
}
