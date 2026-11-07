import type { SlideImage } from "../../domain/deck/slideTypes.ts";

/** The stage is 1280×720; this keeps a 2× cover image without huge data URLs. */
const MAX_EDGE = 1600;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_DATA_URL_LENGTH = 1_800_000;
const ACCEPTED_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/svg+xml",
  "image/webp",
]);

function loadImage(file: File): Promise<{ image: HTMLImageElement; objectUrl: string }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => resolve({ image, objectUrl });
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("That file could not be decoded as an image."));
    };
    image.src = objectUrl;
  });
}

function hasTransparency(context: CanvasRenderingContext2D, width: number, height: number): boolean {
  const pixels = context.getImageData(0, 0, width, height).data;

  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] < 250) return true;
  }

  return false;
}

function altFromFileName(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
  return withoutExtension.slice(0, 200);
}

/**
 * Reads a local image, scales it to a projector-friendly size and returns a
 * self-contained value. Opaque images become JPEG; images with transparency
 * stay PNG so logos keep their edges.
 */
export async function readSlideImageFile(file: File): Promise<SlideImage> {
  if (!ACCEPTED_TYPES.has(file.type)) {
    throw new Error("Choose a PNG, JPEG, GIF, WebP, AVIF or SVG image.");
  }

  if (file.size > MAX_FILE_BYTES) {
    throw new Error("That image is larger than 20 MB; choose a smaller one.");
  }

  const { image, objectUrl } = await loadImage(file);

  try {
    const sourceWidth = image.naturalWidth;
    const sourceHeight = image.naturalHeight;

    if (sourceWidth <= 0 || sourceHeight <= 0) {
      throw new Error("That image has no readable dimensions.");
    }

    const scale = Math.min(1, MAX_EDGE / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("The browser could not prepare that image.");

    context.drawImage(image, 0, 0, width, height);

    // Check the untouched pixels: a white underlay would hide transparency.
    const transparent = hasTransparency(context, width, height);
    const dataUrl = transparent
      ? canvas.toDataURL("image/png")
      : canvas.toDataURL("image/jpeg", 0.82);

    if (dataUrl.length > MAX_DATA_URL_LENGTH) {
      throw new Error("That image is too detailed to store; choose a smaller or simpler one.");
    }

    return {
      src: dataUrl,
      alt: altFromFileName(file.name),
      width,
      height,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
