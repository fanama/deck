/**
 * Sizing helpers for the SVG a diagram slide generates. The preview and the
 * HTML export inline it as markup; the PPTX rasteriser needs an explicit pixel
 * size and an XML namespace before it can load it as an image.
 */

const SVG_OPENING_TAG = /<svg\b[^>]*>/i;

/**
 * Removes what makes pasted SVG dangerous in a document that runs scripts:
 * scripts, HTML islands and inline event handlers. Everything else is kept
 * verbatim — the point of the layout is that the drawing is the author's.
 */


export interface SvgSize {
  width: number;
  height: number;
}

function positiveNumber(value: string | undefined): number | null {
  if (!value) return null;

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function attributeValue(openingTag: string, name: string): string | undefined {
  const match = openingTag.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return match ? match[1] : undefined;
}

/**
 * The drawing's own aspect ratio: `viewBox` first, because that is what an
 * inline SVG scales against, then explicit `width`/`height`, then 16:9.
 */
export function readSvgIntrinsicSize(markup: string): SvgSize {
  const openingTag = markup.match(SVG_OPENING_TAG)?.[0] ?? "";
  const viewBox = attributeValue(openingTag, "viewBox")?.split(/[\s,]+/).map(Number.parseFloat);

  if (viewBox && viewBox.length === 4) {
    const width = positiveNumber(String(viewBox[2]));
    const height = positiveNumber(String(viewBox[3]));
    if (width && height) return { width, height };
  }

  const width = positiveNumber(attributeValue(openingTag, "width"));
  const height = positiveNumber(attributeValue(openingTag, "height"));
  if (width && height) return { width, height };

  return { width: 16, height: 9 };
}

/** The largest box of this ratio that fits inside the given one. */
export function fitWithinBox(size: SvgSize, maxWidth: number, maxHeight: number): SvgSize {
  const scale = Math.min(maxWidth / size.width, maxHeight / size.height);

  return { width: size.width * scale, height: size.height * scale };
}

/**
 * Gives the root element an explicit pixel size and an XML namespace, so the
 * markup can be loaded as an image by the PPTX rasteriser. The `viewBox` is
 * left alone: that is what keeps the drawing's own proportions.
 */
export function withSvgSize(markup: string, widthPx: number, heightPx: number): string {
  const roundedWidth = Math.max(1, Math.round(widthPx));
  const roundedHeight = Math.max(1, Math.round(heightPx));

  const sized = markup.replace(SVG_OPENING_TAG, (openingTag) => {
    const withoutSize = openingTag.replace(/\s(width|height)\s*=\s*(?:"[^"]*"|'[^']*')/gi, "");
    const withNamespace = /\sxmlns\s*=/i.test(withoutSize)
      ? withoutSize
      : withoutSize.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');

    return withNamespace.replace(
      /<svg\b/i,
      `<svg width="${roundedWidth}" height="${roundedHeight}"`,
    );
  });

  return SVG_OPENING_TAG.test(sized) ? sized : "";
}
