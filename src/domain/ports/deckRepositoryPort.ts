import type { Deck } from "../deck/slideTypes.ts";

/**
 * The persistence port the domain and application layers depend on.
 */
export interface DeckRepository {
  /** Persists the whole deck. */
  saveDeck(deck: Deck): void;
  /** Returns the stored deck value, or null when nothing is stored. */
  loadDeck(): unknown;
  /** Removes the stored deck. */
  clearDeck(): void;
}

const REQUIRED_METHODS = ["saveDeck", "loadDeck", "clearDeck"] as const;

/** Fails loudly when an adapter does not honour the port. */
export function assertImplementsDeckRepository(repository: DeckRepository): DeckRepository {
  const missingMethod = REQUIRED_METHODS.find((method) => typeof repository?.[method] !== "function");
  if (missingMethod) throw new TypeError(`Deck repository is missing ${missingMethod}()`);
  return repository;
}
