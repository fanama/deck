import type { Deck } from "../../domain/deck/slideTypes.ts";
import type { DeckPptxExporter } from "../../domain/ports/deckPptxExporterPort.ts";
import { assertImplementsDeckPptxExporter } from "../../domain/ports/deckPptxExporterPort.ts";
import { paletteForTheme } from "./pptxUnits.ts";
import {
  appPropertiesXml,
  contentTypesXml,
  corePropertiesXml,
  packageRelationshipsXml,
  presentationRelationshipsXml,
  presentationXml,
  slideLayoutRelationshipsXml,
  slideLayoutXml,
  slideMasterRelationshipsXml,
  slideMasterXml,
  slideRelationshipsXml,
  themeXml,
} from "./pptxPackageParts.ts";
import { renderSlideXml } from "./renderSlideXml.ts";
import { createStoredZip, utf8Bytes } from "./zipArchive.ts";
import type { ZipEntry } from "./zipArchive.ts";

/**
 * Adapter for the PPTX port. It writes a minimal, valid OPC package: one slide
 * master, one blank layout, a theme carrying the deck accent, and one part per
 * slide. Nothing is rasterised — every box in the deck is a native shape and
 * every word is an editable text run.
 */
export function createPptxDeckExporter(): DeckPptxExporter {
  return assertImplementsDeckPptxExporter({
    exportDeckToPptx(deck: Deck): Uint8Array {
      const slideCount = deck.slides.length;

      const entries: ZipEntry[] = [
        { path: "[Content_Types].xml", bytes: utf8Bytes(contentTypesXml(slideCount)) },
        { path: "_rels/.rels", bytes: utf8Bytes(packageRelationshipsXml()) },
        { path: "docProps/core.xml", bytes: utf8Bytes(corePropertiesXml(deck)) },
        { path: "docProps/app.xml", bytes: utf8Bytes(appPropertiesXml(slideCount)) },
        { path: "ppt/presentation.xml", bytes: utf8Bytes(presentationXml(slideCount)) },
        { path: "ppt/_rels/presentation.xml.rels", bytes: utf8Bytes(presentationRelationshipsXml(slideCount)) },
        { path: "ppt/slideMasters/slideMaster1.xml", bytes: utf8Bytes(slideMasterXml()) },
        { path: "ppt/slideMasters/_rels/slideMaster1.xml.rels", bytes: utf8Bytes(slideMasterRelationshipsXml()) },
        { path: "ppt/slideLayouts/slideLayout1.xml", bytes: utf8Bytes(slideLayoutXml()) },
        { path: "ppt/slideLayouts/_rels/slideLayout1.xml.rels", bytes: utf8Bytes(slideLayoutRelationshipsXml()) },
        { path: "ppt/theme/theme1.xml", bytes: utf8Bytes(themeXml(paletteForTheme(deck.theme))) },
      ];

      deck.slides.forEach((slide, index) => {
        const slidePath = `ppt/slides/slide${index + 1}.xml`;

        entries.push({ path: slidePath, bytes: utf8Bytes(renderSlideXml(slide, deck, index)) });
        entries.push({ path: `ppt/slides/_rels/slide${index + 1}.xml.rels`, bytes: utf8Bytes(slideRelationshipsXml()) });
      });

      return createStoredZip(entries);
    },
  });
}
