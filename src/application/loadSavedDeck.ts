import { restoreDeckFromStoredValue } from "../domain/deck/Deck.ts";
import type { Deck } from "../domain/deck/slideTypes.ts";
import type { DeckRepository } from "../domain/ports/deckRepositoryPort.ts";

/**
 * Loads the saved deck through the repository port. A storage failure or a
 * malformed value is not fatal: the studio falls back to a starter deck.
 */
export function loadSavedDeck(deckRepository: DeckRepository): Deck | null {
  try {
    return restoreDeckFromStoredValue(deckRepository.loadDeck());
  } catch (error) {
    console.warn("Could not read the saved deck:", error);
    return null;
  }
}
