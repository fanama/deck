import type { Deck } from "../domain/deck/slideTypes.ts";

/**
 * An exported deck carries its own data in an inert `<script type="application/
 * json">` block. That is what makes the exported file importable: the document
 * a reader can open is the same document the author can edit again, without a
 * second file format to keep in sync.
 */
export const EMBEDDED_DECK_ELEMENT_ID = "deck-studio-deck";

/** JSON that can sit inside a script element without ending it early. */
export function serializeEmbeddedDeck(deck: Deck): string {
  return JSON.stringify(deck).replace(/</g, "\\u003c");
}

/** Returns the raw JSON stored in an exported document, or null. */
export function readEmbeddedDeckJson(html: string): string | null {
  const pattern = new RegExp(
    `<script[^>]*\\bid=["']${EMBEDDED_DECK_ELEMENT_ID}["'][^>]*>([\\s\\S]*?)</script>`,
    "i",
  );
  const match = pattern.exec(html);
  return match ? match[1].trim() : null;
}
