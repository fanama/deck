import { restoreDeckFromStoredValue } from "../domain/deck/Deck.ts";
import type { Deck } from "../domain/deck/slideTypes.ts";
import { readEmbeddedDeckJson } from "../shared/embeddedDeckData.ts";

export type ParsedDeckFile = { ok: true; deck: Deck } | { ok: false; message: string };

const NO_DECK_MESSAGE =
  "That file has no deck data. Import an HTML file exported from Deck Studio, or a deck .json file.";

/**
 * Reads either a deck `.json` file or an HTML file this studio exported, and
 * hands the value to the domain restorer — the same validation that guards
 * localStorage. A file is either a whole deck or it is rejected; a half-read
 * deck is never put in front of the author.
 */
export function parseDeckFileText(fileText: string): ParsedDeckFile {
  const trimmedText = fileText.trim();

  if (!trimmedText) {
    return { ok: false, message: "That file is empty." };
  }

  const deckJson = trimmedText.startsWith("{") ? trimmedText : readEmbeddedDeckJson(trimmedText);

  if (deckJson === null) {
    return { ok: false, message: NO_DECK_MESSAGE };
  }

  let storedValue: unknown;

  try {
    storedValue = JSON.parse(deckJson);
  } catch {
    return { ok: false, message: "That file's deck data is not valid JSON." };
  }

  const deck = restoreDeckFromStoredValue(storedValue);

  if (!deck) {
    return { ok: false, message: "That file does not contain a deck Deck Studio can read." };
  }

  return { ok: true, deck };
}
