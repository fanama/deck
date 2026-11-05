import type { Deck } from "../deck/slideTypes.ts";

/**
 * The persistence port the domain and application layers depend on. A browser
 * holds a library of decks rather than a single document, so one save covers
 * every deck and which one is open.
 */
export interface DeckLibrary {
  decks: Deck[];
  activeDeckId: string;
}

export interface DeckRepository {
  /** Persists the whole library, including the active deck id. */
  saveLibrary(library: DeckLibrary): void;
  /** Returns the stored library value, or null when nothing is stored. */
  loadLibrary(): unknown;
  /** Removes the library (and any deck saved by an earlier single-deck build). */
  clearAll(): void;
}

const REQUIRED_METHODS = ["saveLibrary", "loadLibrary", "clearAll"] as const;

/** Fails loudly when an adapter does not honour the port. */
export function assertImplementsDeckRepository(repository: DeckRepository): DeckRepository {
  const missingMethod = REQUIRED_METHODS.find((method) => typeof repository?.[method] !== "function");
  if (missingMethod) throw new TypeError(`Deck repository is missing ${missingMethod}()`);
  return repository;
}
