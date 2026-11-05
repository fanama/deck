import type { Deck } from "../deck/slideTypes.ts";

/**
 * The PowerPoint export port. Unlike the HTML port, a PPTX is a binary
 * package, so the adapter returns bytes the browser can download as-is.
 */
/**
 * A PPTX package can carry pictures, so writing one may wait on the browser
 * drawing an SVG to a bitmap — hence a promise rather than bare bytes.
 */
export interface DeckPptxExporter {
  exportDeckToPptx(deck: Deck): Promise<Uint8Array>;
}

/** Fails loudly when an adapter does not honour the port. */
export function assertImplementsDeckPptxExporter(exporter: DeckPptxExporter): DeckPptxExporter {
  if (typeof exporter?.exportDeckToPptx !== "function") {
    throw new TypeError("Deck PPTX exporter is missing exportDeckToPptx()");
  }
  return exporter;
}
