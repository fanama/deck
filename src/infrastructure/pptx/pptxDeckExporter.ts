import { buildDiagramThemeColors } from "../../domain/deck/deckTheme.ts";
import type { Deck, SlideImage } from "../../domain/deck/slideTypes.ts";
import type { DeckPptxExporter } from "../../domain/ports/deckPptxExporterPort.ts";
import { assertImplementsDeckPptxExporter } from "../../domain/ports/deckPptxExporterPort.ts";
import { buildDiagramSvg } from "../../shared/diagramSvg.ts";
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
import type { SlideImageRelationship } from "./pptxPackageParts.ts";
import { renderSlideXml } from "./renderSlideXml.ts";
import type { SlideImageAsset, SlideRenderAssets } from "./renderSlideXml.ts";
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

interface DecodedImage {
  bytes: Uint8Array;
  extension: "png" | "jpg" | "gif";
}

/** Images inside a deck are always data URLs; the PPTX reuses those bytes. */
function decodeImageDataUrl(src: string): DecodedImage | null {
  const match = /^data:image\/(png|jpeg|gif);base64,([a-z0-9+/=\s]+)$/i.exec(src);
  if (!match) return null;

  try {
    const mime = match[1].toLowerCase();
    const binary = atob(match[2].replace(/\s/g, ""));
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return {
      bytes,
      extension: mime === "jpeg" ? "jpg" : mime,
    } as DecodedImage;
  } catch {
    return null;
  }
}

/**
 * Adapter for the PPTX port. It writes a minimal, valid OPC package: one slide
 * master, one blank layout, a theme carrying the deck palette, one part per
 * slide and whatever image parts the deck uses. Every heading stays editable
 * text; only diagrams and uploaded images are pictures, because that is what
 * the author supplied.
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
      const assetsBySlide = new Map<
        string,
        { render: SlideRenderAssets; relationships: SlideImageRelationship[] }
      >();
      const mediaEntries: ZipEntry[] = [];
      const imageExtensions = new Set<string>();

      for (const [index, slide] of deck.slides.entries()) {
        let nextRelationship = 2;
        const relationships: SlideImageRelationship[] = [];
        const render: SlideRenderAssets = {
          backgroundImage: null,
          contentImage: null,
          diagramImage: null,
        };

        const addMedia = (
          role: string,
          bytes: Uint8Array,
          extension: string,
          pixelWidth: number,
          pixelHeight: number,
        ): SlideImageAsset => {
          const mediaName = `slide${index + 1}-${role}.${extension}`;
          const relId = `rId${nextRelationship++}`;

          mediaEntries.push({ path: `ppt/media/${mediaName}`, bytes });
          imageExtensions.add(extension);
          relationships.push({ relId, target: `../media/${mediaName}` });

          return {
            relId,
            pixelWidth: Math.max(1, Math.round(pixelWidth)),
            pixelHeight: Math.max(1, Math.round(pixelHeight)),
          };
        };

        const addStoredImage = (role: string, image: SlideImage): SlideImageAsset | null => {
          const decoded = decodeImageDataUrl(image.src);
          if (!decoded) return null;

          return addMedia(role, decoded.bytes, decoded.extension, image.width, image.height);
        };

        if (slide.backgroundImage) {
          render.backgroundImage = addStoredImage("background", slide.backgroundImage);
        }

        if (slide.layout === "image" && slide.content.image) {
          render.contentImage = addStoredImage("image", slide.content.image);
        }

        if (slide.layout === "diagram" && slide.content.boxes.length > 0) {
          const markup = buildDiagramSvg({
            boxes: slide.content.boxes,
            links: slide.content.links,
            title: slide.content.heading,
            colors: buildDiagramThemeColors(deck.theme),
            routing: slide.content.routing,
          });
          const frame = frameForLayout(slide.layout);
          const raster = await rasteriseSvg(
            markup,
            frame.width,
            Math.max(DIAGRAM_TEXT_RESERVE, frame.bottom - frame.top - DIAGRAM_TEXT_RESERVE),
          );

          if (raster) {
            render.diagramImage = addMedia(
              "diagram",
              raster.bytes,
              "png",
              raster.widthPx,
              raster.heightPx,
            );
          }
        }

        assetsBySlide.set(slide.id, { render, relationships });
      }

      const entries: ZipEntry[] = [
        {
          path: "[Content_Types].xml",
          bytes: utf8Bytes(contentTypesXml(slideCount, imageExtensions)),
        },
        { path: "_rels/.rels", bytes: utf8Bytes(packageRelationshipsXml()) },
        { path: "docProps/core.xml", bytes: utf8Bytes(corePropertiesXml(deck)) },
        { path: "docProps/app.xml", bytes: utf8Bytes(appPropertiesXml(slideCount)) },
        { path: "ppt/presentation.xml", bytes: utf8Bytes(presentationXml(slideCount)) },
        { path: "ppt/_rels/presentation.xml.rels", bytes: utf8Bytes(presentationRelationshipsXml(slideCount)) },
        { path: "ppt/slideMasters/slideMaster1.xml", bytes: utf8Bytes(slideMasterXml(palette)) },
        { path: "ppt/slideMasters/_rels/slideMaster1.xml.rels", bytes: utf8Bytes(slideMasterRelationshipsXml()) },
        { path: "ppt/slideLayouts/slideLayout1.xml", bytes: utf8Bytes(slideLayoutXml()) },
        { path: "ppt/slideLayouts/_rels/slideLayout1.xml.rels", bytes: utf8Bytes(slideLayoutRelationshipsXml()) },
        { path: "ppt/theme/theme1.xml", bytes: utf8Bytes(themeXml(palette)) },
      ];

      deck.slides.forEach((slide, index) => {
        const slidePath = `ppt/slides/slide${index + 1}.xml`;
        const assets = assetsBySlide.get(slide.id) ?? {
          render: {
            backgroundImage: null,
            contentImage: null,
            diagramImage: null,
          },
          relationships: [],
        };

        entries.push({
          path: slidePath,
          bytes: utf8Bytes(renderSlideXml(slide, deck, index, assets.render)),
        });
        entries.push({
          path: `ppt/slides/_rels/slide${index + 1}.xml.rels`,
          bytes: utf8Bytes(slideRelationshipsXml(assets.relationships)),
        });
      });

      entries.push(...mediaEntries);

      return createStoredZip(entries);
    },
  });
}
