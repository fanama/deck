import type { Deck } from "../../domain/deck/slideTypes.ts";
import { assertImplementsDeckRepository } from "../../domain/ports/deckRepositoryPort.ts";
import type { DeckRepository } from "../../domain/ports/deckRepositoryPort.ts";

const STORAGE_KEY = "deck-studio.deck.v1";

function resolveLocalStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch (error) {
    console.warn("Local storage is not reachable:", error);
    return null;
  }
}

/**
 * Browser adapter for the deck repository port. It stores one deck under a
 * versioned key; the version suffix is what lets a later format change start
 * clean instead of crashing on old data. When storage is unavailable the
 * methods fail and the application layer reports it in the notice bar.
 */
export function createLocalStorageDeckRepository(
  storage: Storage | null = resolveLocalStorage(),
): DeckRepository {
  function requireStorage(): Storage {
    if (!storage) throw new Error("Local storage is not available in this browser");
    return storage;
  }

  return assertImplementsDeckRepository({
    saveDeck(deck: Deck): void {
      requireStorage().setItem(STORAGE_KEY, JSON.stringify(deck));
    },
    loadDeck(): unknown {
      const storedValue = requireStorage().getItem(STORAGE_KEY);
      return storedValue ? JSON.parse(storedValue) : null;
    },
    clearDeck(): void {
      requireStorage().removeItem(STORAGE_KEY);
    },
  });
}
