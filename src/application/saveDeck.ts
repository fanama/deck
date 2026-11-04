import type { Deck } from "../domain/deck/slideTypes.ts";
import type { DeckRepository } from "../domain/ports/deckRepositoryPort.ts";

export type SaveDeckResult = { ok: true } | { ok: false; message: string };

/**
 * Persists a deck through the repository port and reports the outcome
 * instead of throwing, so the studio can show it in the notice bar.
 */
export function saveDeck(deckRepository: DeckRepository, deck: Deck): SaveDeckResult {
  try {
    deckRepository.saveDeck({ ...deck, updatedAt: new Date().toISOString() });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `The deck could not be saved: ${message}` };
  }
}
