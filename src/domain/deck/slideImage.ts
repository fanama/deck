import type { SlideImage } from "./slideTypes.ts";

/**
 * Uploaded images travel inside the deck, so a stored image is always a data
 * URL. Accept only raster formats the browser and PowerPoint both understand;
 * the uploader re-encodes other formats to PNG or JPEG.
 */
const IMAGE_DATA_URL = /^data:image\/(?:png|jpeg|gif);base64,[a-z0-9+/=\s]+$/i;

function positiveDimension(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : null;
}

/** Returns a trustworthy image value, or null when the stored data is unusable. */
export function normalizeSlideImage(value: unknown): SlideImage | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Record<string, unknown>;
  const src = typeof candidate.src === "string" ? candidate.src.trim() : "";
  const width = positiveDimension(candidate.width);
  const height = positiveDimension(candidate.height);

  if (!IMAGE_DATA_URL.test(src) || width === null || height === null) return null;

  return {
    src,
    alt: typeof candidate.alt === "string" ? candidate.alt.trim().slice(0, 200) : "",
    width: Math.min(width, 10000),
    height: Math.min(height, 10000),
  };
}
