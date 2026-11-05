import { restoreDeckFromStoredValue } from "../domain/deck/Deck.ts";
import type { Deck } from "../domain/deck/slideTypes.ts";
import type { DeckLibrary, DeckRepository } from "../domain/ports/deckRepositoryPort.ts";

/**
 * Loads the saved library through the repository port. Decks that no longer
 * parse are dropped instead of taking the whole library down; a storage
 * failure or an empty result is not fatal, the studio falls back to the
 * starter deck.
 */
export function loadSavedLibrary(deckRepository: DeckRepository): DeckLibrary | null {
  try {
    const stored = deckRepository.loadLibrary();
    if (!stored || typeof stored !== "object") return null;

    const record = stored as { decks?: unknown; activeDeckId?: unknown };
    if (!Array.isArray(record.decks)) return null;

    const decks = record.decks
      .map((value) => restoreDeckFromStoredValue(value))
      .filter((deck): deck is Deck => deck !== null);

    const firstDeck = decks[0];
    if (!firstDeck) return null;

    const storedActiveId = typeof record.activeDeckId === "string" ? record.activeDeckId : "";
    const activeDeckId = decks.some((deck) => deck.id === storedActiveId) ? storedActiveId : firstDeck.id;

    return { decks, activeDeckId };
  } catch (error) {
    console.warn("Could not read the saved decks:", error);
    return null;
  }
}
