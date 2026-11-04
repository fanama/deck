import { findDeckProblems, hasBlockingProblems } from "../domain/deck/deckProblems.ts";
import type { DeckProblem } from "../domain/deck/deckProblems.ts";
import type { Deck } from "../domain/deck/slideTypes.ts";
import type { DeckExporter } from "../domain/ports/deckExporterPort.ts";
import { toFileNameSlug } from "../shared/fileName.ts";

export type ExportDeckResult =
  | { ok: true; problems: DeckProblem[]; html: string; fileName: string }
  | { ok: false; problems: DeckProblem[] };

/**
 * Checks the deck, asks the exporter port for the document and returns
 * everything the browser adapter needs to download it. Nothing is written
 * when the deck still has blocking problems.
 */
export function exportDeckAsHtmlFile({
  deckExporter,
  deck,
}: {
  deckExporter: DeckExporter;
  deck: Deck;
}): ExportDeckResult {
  const problems = findDeckProblems(deck);

  if (hasBlockingProblems(problems)) {
    return { ok: false, problems };
  }

  return {
    ok: true,
    problems,
    html: deckExporter.exportDeckToHtml(deck),
    fileName: `${toFileNameSlug(deck.title)}.html`,
  };
}
