import type { Deck } from "../deck/slideTypes.ts";

/**
 * The export port. An adapter turns a deck into one self-contained document
 * string; the application layer never knows how that document is built.
 */
export interface DeckExporter {
  exportDeckToHtml(deck: Deck): string;
}

/** Fails loudly when an adapter does not honour the port. */
export function assertImplementsDeckExporter(exporter: DeckExporter): DeckExporter {
  if (typeof exporter?.exportDeckToHtml !== "function") {
    throw new TypeError("Deck exporter is missing exportDeckToHtml()");
  }
  return exporter;
}
