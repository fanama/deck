import deckStylesheet from "../../design/deck.css?raw";
import { buildDeckThemeVariables, toStyleAttributeValue } from "../../domain/deck/deckTheme.ts";
import type { Deck } from "../../domain/deck/slideTypes.ts";
import { assertImplementsDeckExporter } from "../../domain/ports/deckExporterPort.ts";
import type { DeckExporter } from "../../domain/ports/deckExporterPort.ts";
import { EMBEDDED_DECK_ELEMENT_ID, serializeEmbeddedDeck } from "../../shared/embeddedDeckData.ts";
import { escapeHtml } from "../../shared/escapeHtml.ts";
import { DECK_DOCUMENT_CSS } from "./deckDocumentCss.ts";
import { DECK_NAVIGATION_SCRIPT } from "./deckNavigationScript.ts";
import { renderSlideSectionHtml } from "./renderSlideHtml.ts";

const NAVIGATION_HINT = "← → · space · home / end · F for full screen";

/**
 * Adapter for the deck exporter port. It writes one HTML document containing
 * the stylesheet, the slides, the navigation script and the print rules —
 * nothing else. The result opens from disk with no server and no network.
 */
export function createHtmlDeckExporter(): DeckExporter {
  return assertImplementsDeckExporter({
    exportDeckToHtml(deck: Deck): string {
      const totalSlides = deck.slides.length;
      const themeVariables = toStyleAttributeValue(buildDeckThemeVariables(deck.theme));

      const sections = deck.slides
        .map((slide, index) =>
          renderSlideSectionHtml({
            slide,
            slideNumber: index + 1,
            totalSlides,
            footerLabel: deck.footerLabel,
            isActive: index === 0,
            theme: deck.theme,
          }),
        )
        .join("\n\n");

      return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(deck.title)}</title>
<script type="application/json" id="${EMBEDDED_DECK_ELEMENT_ID}">${serializeEmbeddedDeck(deck)}</script>
<style>
${deckStylesheet}
${DECK_DOCUMENT_CSS}
:root { ${themeVariables}; }
</style>
</head>
<body>

<div class="progress" id="progress"></div>

<div class="viewport">
  <div class="stage" id="stage">

${sections}

  </div>
</div>

<div class="hint">${NAVIGATION_HINT}</div>

<div class="chrome">
  <button id="prev" aria-label="Previous slide">←</button>
  <span class="counter" id="counter">1 / ${totalSlides}</span>
  <button id="next" aria-label="Next slide">→</button>
</div>

<script>
${DECK_NAVIGATION_SCRIPT}
</script>
</body>
</html>
`;
    },
  });
}
