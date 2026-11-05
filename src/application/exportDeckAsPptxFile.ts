import { findDeckProblems, hasBlockingProblems } from "../domain/deck/deckProblems.ts";
import type { DeckProblem } from "../domain/deck/deckProblems.ts";
import type { Deck } from "../domain/deck/slideTypes.ts";
import type { DeckPptxExporter } from "../domain/ports/deckPptxExporterPort.ts";
import { toFileNameSlug } from "../shared/fileName.ts";

export type ExportPptxResult =
  | { ok: true; problems: DeckProblem[]; bytes: Uint8Array; fileName: string }
  | { ok: false; problems: DeckProblem[] };

/**
 * Validates the deck and asks the PPTX port for the package. The same
 * blocking problems that stop an HTML export stop this one, so a deck that
 * cannot be exported is reported once, in one place.
 */
export async function exportDeckAsPptxFile({
  deckPptxExporter,
  deck,
}: {
  deckPptxExporter: DeckPptxExporter;
  deck: Deck;
}): Promise<ExportPptxResult> {
  const problems = findDeckProblems(deck);

  if (hasBlockingProblems(problems)) {
    return { ok: false, problems };
  }

  return {
    ok: true,
    problems,
    bytes: await deckPptxExporter.exportDeckToPptx(deck),
    fileName: `${toFileNameSlug(deck.title)}.pptx`,
  };
}
