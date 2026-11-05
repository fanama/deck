import type { DeckLibrary, DeckRepository } from "../domain/ports/deckRepositoryPort.ts";

export type SaveDeckResult = { ok: true } | { ok: false; message: string };

/**
 * Persists the whole library through the repository port and reports the
 * outcome instead of throwing, so the studio can show it in the notice bar.
 * Only the open deck's timestamp moves; the others are left untouched.
 */
export function saveDeckLibrary(deckRepository: DeckRepository, library: DeckLibrary): SaveDeckResult {
  try {
    const timestamp = new Date().toISOString();

    deckRepository.saveLibrary({
      decks: library.decks.map((deck) =>
        deck.id === library.activeDeckId ? { ...deck, updatedAt: timestamp } : deck,
      ),
      activeDeckId: library.activeDeckId,
    });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `The deck library could not be saved: ${message}` };
  }
}
