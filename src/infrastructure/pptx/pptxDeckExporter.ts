import type { Deck } from "../../domain/deck/slideTypes.ts";
import type { DeckPptxExporter } from "../../domain/ports/deckPptxExporterPort.ts";
import { assertImplementsDeckPptxExporter } from "../../domain/ports/deckPptxExporterPort.ts";
import { buildDiagramSvg, DIAGRAM_COLORS } from "../../shared/diagramSvg.ts";
import { frameForLayout, paletteForTheme } from "./pptxUnits.ts";
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
import type { DiagramImage } from "./renderSlideXml.ts";
import { createStoredZip, utf8Bytes } from "./zipArchive.ts";
import type { ZipEntry } from "./zipArchive.ts";

/** A drawing measured in pixels, ready to become a PNG part. */
export interface DiagramRaster {
  bytes: Uint8Array;
  widthPx: number;
  heightPx: number;
}

/**
 * Draws SVG markup to a bitmap of at most the given box. Returns null when the
 * browser cannot load the markup, so a broken paste never breaks the export.
 */
export type SvgRasteriser = (
  svg: string,
  maxWidthPx: number,
  maxHeightPx: number,
) => Promise<DiagramRaster | null>;

/** Vertical room a diagram slide keeps for its heading and footline. */
const DIAGRAM_TEXT_RESERVE = 150;

/**
 * Adapter for the PPTX port. It writes a minimal, valid OPC package: one slide
 * master, one blank layout, a theme carrying the deck accent, and one part per
 * slide. Every box in the deck is a native shape and every word an editable
 * text run; only a diagram is a picture, because PowerPoint pictures are
 * bitmaps and the browser is the only thing that can draw the authored SVG.
 */
export function createPptxDeckExporter({
  rasteriseSvg,
}: {
  rasteriseSvg: SvgRasteriser;
}): DeckPptxExporter {
  return assertImplementsDeckPptxExporter({
    async exportDeckToPptx(deck: Deck): Promise<Uint8Array> {
      const slideCount = deck.slides.length;
      const palette = paletteForTheme(deck.theme);
      const diagrams = new Map<string, DiagramImage & { target: string }>();
      const mediaEntries: ZipEntry[] = [];

      for (const [index, slide] of deck.slides.entries()) {
        if (slide.layout !== "diagram") continue;

        if (slide.content.boxes.length === 0) continue;

        const markup = buildDiagramSvg({
          boxes: slide.content.boxes,
          links: slide.content.links,
          title: slide.content.heading,
          colors: { ...DIAGRAM_COLORS, accent: `#${palette.accent}` },
          routing: slide.content.routing,
        });
        const frame = frameForLayout(slide.layout);
        const raster = await rasteriseSvg(
          markup,
          frame.width,
          Math.max(DIAGRAM_TEXT_RESERVE, frame.bottom - frame.top - DIAGRAM_TEXT_RESERVE),
        );
        if (!raster) continue;

        const mediaName = `diagram${index + 1}.png`;
        mediaEntries.push({ path: `ppt/media/${mediaName}`, bytes: raster.bytes });
        diagrams.set(slide.id, {
          relId: "rId2",
          target: `../media/${mediaName}`,
          pixelWidth: raster.widthPx,
          pixelHeight: raster.heightPx,
        });
      }

      const entries: ZipEntry[] = [
        { path: "[Content_Types].xml", bytes: utf8Bytes(contentTypesXml(slideCount, mediaEntries.length > 0)) },
        { path: "_rels/.rels", bytes: utf8Bytes(packageRelationshipsXml()) },
        { path: "docProps/core.xml", bytes: utf8Bytes(corePropertiesXml(deck)) },
        { path: "docProps/app.xml", bytes: utf8Bytes(appPropertiesXml(slideCount)) },
        { path: "ppt/presentation.xml", bytes: utf8Bytes(presentationXml(slideCount)) },
        { path: "ppt/_rels/presentation.xml.rels", bytes: utf8Bytes(presentationRelationshipsXml(slideCount)) },
        { path: "ppt/slideMasters/slideMaster1.xml", bytes: utf8Bytes(slideMasterXml()) },
        { path: "ppt/slideMasters/_rels/slideMaster1.xml.rels", bytes: utf8Bytes(slideMasterRelationshipsXml()) },
        { path: "ppt/slideLayouts/slideLayout1.xml", bytes: utf8Bytes(slideLayoutXml()) },
        { path: "ppt/slideLayouts/_rels/slideLayout1.xml.rels", bytes: utf8Bytes(slideLayoutRelationshipsXml()) },
        { path: "ppt/theme/theme1.xml", bytes: utf8Bytes(themeXml(palette)) },
      ];

      deck.slides.forEach((slide, index) => {
        const slidePath = `ppt/slides/slide${index + 1}.xml`;

        entries.push({
          path: slidePath,
          bytes: utf8Bytes(renderSlideXml(slide, deck, index, diagrams.get(slide.id) ?? null)),
        });
        entries.push({
          path: `ppt/slides/_rels/slide${index + 1}.xml.rels`,
          bytes: utf8Bytes(slideRelationshipsXml(diagrams.get(slide.id)?.target)),
        });
      });

      entries.push(...mediaEntries);

      return createStoredZip(entries);
    },
  });
}
