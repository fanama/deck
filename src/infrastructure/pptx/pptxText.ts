import { escapeHtml } from "../../shared/escapeHtml.ts";
import { clampRectToSlide, toEmu, toHundredthsOfPoint } from "./pptxUnits.ts";

/**
 * Text in PPTX is a real text box with runs, never an image. Nothing measures
 * text in the browser here (the exporter also runs in Node), so wrapping is
 * estimated from average glyph width: good enough to place boxes and stack
 * them without overlap, and PowerPoint re-wraps on its own when it opens.
 */

export type FontFamily = "serif" | "sans" | "mono";

/** PowerPoint cannot resolve CSS system families, so these travel instead. */
export const FONT_TYPEFACE: Record<FontFamily, string> = {
  serif: "Georgia",
  sans: "Arial",
  mono: "Consolas",
};

const AVERAGE_GLYPH_WIDTH: Record<FontFamily, number> = {
  serif: 0.5,
  sans: 0.53,
  mono: 0.6,
};

export interface TextStyle {
  fontPx: number;
  /** CSS line-height multiplier. */
  lineHeight: number;
  family: FontFamily;
  color: string;
  bold?: boolean;
  /** Rendered in capitals without changing the stored text (CSS text-transform). */
  caps?: boolean;
  /** Tracking in px, the CSS letter-spacing equivalent. */
  letterSpacingPx?: number;
}

export interface TextMeasurement {
  lines: string[];
  heightPx: number;
}

/** Greedy word wrap at an estimated character budget per line. */
export function wrapText(text: string, style: TextStyle, maxWidthPx: number): string[] {
  const glyphWidth = style.fontPx * AVERAGE_GLYPH_WIDTH[style.family] * (style.bold ? 1.06 : 1);
  const maxCharacters = Math.max(6, Math.floor(maxWidthPx / glyphWidth));
  const lines: string[] = [];

  for (const paragraph of text.split("\n")) {
    if (paragraph.trim() === "") {
      lines.push("");
      continue;
    }

    let line = "";

    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;

      if (candidate.length <= maxCharacters) {
        line = candidate;
        continue;
      }

      if (line) lines.push(line);

      let remainder = word;
      while (remainder.length > maxCharacters) {
        lines.push(remainder.slice(0, maxCharacters));
        remainder = remainder.slice(maxCharacters);
      }

      line = remainder;
    }

    lines.push(line);
  }

  return lines.length > 0 ? lines : [""];
}

export function measureText(text: string, style: TextStyle, maxWidthPx: number): TextMeasurement {
  const lines = wrapText(text, style, maxWidthPx);
  return { lines, heightPx: lines.length * style.fontPx * style.lineHeight };
}

/** Estimated rendered width of one unbroken line, used to place pills in rows. */
export function estimateTextWidth(text: string, style: TextStyle): number {
  const tracking = (style.letterSpacingPx ?? 0) * text.length;
  return text.length * style.fontPx * AVERAGE_GLYPH_WIDTH[style.family] * (style.bold ? 1.06 : 1) + tracking;
}

export interface ParagraphSpec {
  text: string;
  style: TextStyle;
  spaceAfterPx?: number;
  /** Draws a real bullet from the deck accent instead of a picture of a dot. */
  bulletColor?: string;
  align?: "l" | "ctr" | "r";
}

function runXml(text: string, style: TextStyle): string {
  const fontTypeface = FONT_TYPEFACE[style.family];
  const fontWeight = style.bold ? 1 : 0;
  const caps = style.caps ? ` cap="all"` : "";
  const tracking = style.letterSpacingPx ? ` spc="${Math.round(style.letterSpacingPx * 75)}"` : "";

  return (
    `<a:r><a:rPr lang="en-US" sz="${toHundredthsOfPoint(style.fontPx)}" b="${fontWeight}"${caps}${tracking} dirty="0">` +
    `<a:solidFill><a:srgbClr val="${style.color}"/></a:solidFill>` +
    `<a:latin typeface="${fontTypeface}"/></a:rPr>` +
    `<a:t>${escapeHtml(text)}</a:t></a:r>`
  );
}

function paragraphPropertiesXml(spec: ParagraphSpec): string {
  const attributes = spec.align ? ` algn="${spec.align}"` : "";
  const lineSpacing = `<a:lnSpc><a:spcPct val="${Math.round(spec.style.lineHeight * 100000)}"/></a:lnSpc>`;
  const spaceAfter = spec.spaceAfterPx
    ? `<a:spcAft><a:spcPts val="${Math.round(spec.spaceAfterPx * 75)}"/></a:spcAft>`
    : "";
  const bullet = spec.bulletColor
    ? `<a:buClr><a:srgbClr val="${spec.bulletColor}"/></a:buClr><a:buFont typeface="Arial"/><a:buChar char="•"/>`
    : `<a:buNone/>`;

  const margins = spec.bulletColor ? ` marL="228600" indent="-228600"` : "";

  return `<a:pPr${attributes}${margins}>${lineSpacing}${spaceAfter}${bullet}</a:pPr>`;
}

function paragraphXml(spec: ParagraphSpec): string {
  const runs = spec.text
    .split("\n")
    .map((line, index) => `${index > 0 ? "<a:br/>" : ""}${line ? runXml(line, spec.style) : ""}`)
    .join("");

  return `<a:p>${paragraphPropertiesXml(spec)}${runs}</a:p>`;
}

export interface TextBoxSpec {
  id: number;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  paragraphs: ParagraphSpec[];
  anchor?: "t" | "ctr" | "b";
  insetPx?: number;
}

/** A transparent text box whose own frame does not draw a fill or an outline. */
export function textBoxXml(spec: TextBoxSpec): string {
  const paragraphs = spec.paragraphs.filter((paragraph) => paragraph.text.trim() !== "");
  if (paragraphs.length === 0) return "";

  const inset = toEmu(spec.insetPx ?? 0);
  const anchor = spec.anchor ?? "t";
  const body = paragraphs.map(paragraphXml).join("");
  const rect = clampRectToSlide(spec);

  return (
    `<p:sp><p:nvSpPr><p:cNvPr id="${spec.id}" name="${escapeHtml(spec.name)}"/>` +
    `<p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="${toEmu(rect.x)}" y="${toEmu(rect.y)}"/>` +
    `<a:ext cx="${toEmu(rect.width)}" cy="${toEmu(rect.height)}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr>` +
    `<p:txBody><a:bodyPr wrap="square" lIns="${inset}" tIns="${inset}" rIns="${inset}" bIns="${inset}" ` +
    `anchor="${anchor}"><a:noAutofit/></a:bodyPr><a:lstStyle/>${body}</p:txBody></p:sp>`
  );
}
