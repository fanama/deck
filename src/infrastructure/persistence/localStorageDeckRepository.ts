import { assertImplementsDeckRepository } from "../../domain/ports/deckRepositoryPort.ts";
import type { DeckLibrary, DeckRepository } from "../../domain/ports/deckRepositoryPort.ts";

const STORAGE_KEY = "deck-studio.library.v1";
/** Written by builds that kept one deck; read once so nothing is lost. */
const LEGACY_STORAGE_KEY = "deck-studio.deck.v1";

function resolveLocalStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch (error) {
    console.warn("Local storage is not reachable:", error);
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

interface StoredLibrary {
  decks: unknown[];
  activeDeckId?: unknown;
}

function readStoredLibrary(storage: Storage): StoredLibrary | null {
  const stored = storage.getItem(STORAGE_KEY);

  if (stored) {
    const parsed: unknown = JSON.parse(stored);

    return isRecord(parsed) && Array.isArray(parsed.decks)
      ? { decks: parsed.decks, activeDeckId: parsed.activeDeckId }
      : null;
  }

  const legacy = storage.getItem(LEGACY_STORAGE_KEY);
  if (!legacy) return null;

  const deck: unknown = JSON.parse(legacy);
  return isRecord(deck) ? { decks: [deck], activeDeckId: deck.id } : null;
}

/**
 * Browser adapter for the deck repository port. It stores the whole library
 * under a versioned key; the version suffix is what lets a later format change
 * start clean instead of crashing on old data. A library written by an earlier
 * single-deck build is migrated on first read. When storage is unavailable the
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
    saveLibrary(library: DeckLibrary): void {
      requireStorage().setItem(STORAGE_KEY, JSON.stringify(library));
    },
    loadLibrary(): unknown {
      return readStoredLibrary(requireStorage());
    },
    clearAll(): void {
      const target = requireStorage();
      target.removeItem(STORAGE_KEY);
      target.removeItem(LEGACY_STORAGE_KEY);
    },
  });
}
