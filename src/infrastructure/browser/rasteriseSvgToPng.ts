import { fitWithinBox, readSvgIntrinsicSize, withSvgSize } from "../../shared/svgMarkup.ts";
import type { DiagramRaster } from "../pptx/pptxDeckExporter.ts";

/**
 * Draws SVG markup to a PNG through an offscreen canvas. This is the one
 * browser-only step of the PPTX export: PowerPoint carries the diagram as a
 * picture, and only a renderer can turn the authored markup into pixels.
 */

/** Two pixels per CSS px, so the picture stays sharp when scaled up. */
const OUTPUT_SCALE = 2;
/** Above this the PNG grows without adding anything projectors can show. */
const MAX_OUTPUT_PX = 2400;

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

export async function rasteriseSvgToPng(
  svg: string,
  maxWidthPx: number,
  maxHeightPx: number,
): Promise<DiagramRaster | null> {
  const fitted = fitWithinBox(readSvgIntrinsicSize(svg), maxWidthPx, maxHeightPx);
  const scale = Math.min(OUTPUT_SCALE, MAX_OUTPUT_PX / Math.max(fitted.width, fitted.height));
  const widthPx = Math.max(1, Math.round(fitted.width * scale));
  const heightPx = Math.max(1, Math.round(fitted.height * scale));

  const document = withSvgSize(svg, widthPx, heightPx);
  if (!document) return null;

  const image = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(document)}`);
  if (!image) return null;

  const canvas = window.document.createElement("canvas");
  canvas.width = widthPx;
  canvas.height = heightPx;

  const context = canvas.getContext("2d");
  if (!context) return null;

  context.drawImage(image, 0, 0, widthPx, heightPx);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return null;

  return { bytes: new Uint8Array(await blob.arrayBuffer()), widthPx, heightPx };
}
