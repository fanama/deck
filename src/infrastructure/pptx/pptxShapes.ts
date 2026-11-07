import { escapeHtml } from "../../shared/escapeHtml.ts";
import { clampRectToSlide, toEmu } from "./pptxUnits.ts";

/**
 * Native shapes for everything the HTML deck draws with a box: cards, lanes,
 * pills, rules and the footer hairline. Each one stays editable in PowerPoint
 * because it is a DrawingML shape, not part of a picture.
 */

export interface GradientFill {
  from: string;
  to: string;
  /** CSS gradient angle; 90° points right, matching the cover slide. */
  angleDegrees: number;
}

export type ShapeFill = string | GradientFill | { color: string; alpha: number };

export interface ShapeSpec {
  id: number;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: ShapeFill;
  line?: { color: string; widthPx?: number; alpha?: number };
  geometry?: "rect" | "roundRect";
  /** Corner radius in px; converted to the rounded-rectangle adjustment value. */
  radiusPx?: number;
}

function gradientXml({ from, to, angleDegrees }: GradientFill): string {
  // DrawingML measures clockwise from the positive x axis; CSS from "up".
  const angle = Math.round(((angleDegrees - 90) % 360) * 60000);

  return (
    `<a:gradFill rotWithShape="1"><a:gsLst>` +
    `<a:gs pos="0"><a:srgbClr val="${from}"/></a:gs>` +
    `<a:gs pos="100000"><a:srgbClr val="${to}"/></a:gs>` +
    `</a:gsLst><a:lin ang="${angle}" scaled="0"/></a:gradFill>`
  );
}

function alphaXml(color: string, alpha: number): string {
  return `<a:srgbClr val="${color}"><a:alpha val="${Math.round(alpha * 100000)}"/></a:srgbClr>`;
}

function fillXml(fill: ShapeFill | undefined): string {
  if (!fill) return "<a:noFill/>";
  if (typeof fill === "string") return `<a:solidFill><a:srgbClr val="${fill}"/></a:solidFill>`;
  if ("color" in fill) return `<a:solidFill>${alphaXml(fill.color, fill.alpha)}</a:solidFill>`;
  return gradientXml(fill);
}

function outlineXml(line: ShapeSpec["line"]): string {
  if (!line) return "<a:ln><a:noFill/></a:ln>";

  const color = line.alpha === undefined ? `<a:srgbClr val="${line.color}"/>` : alphaXml(line.color, line.alpha);
  return `<a:ln w="${toEmu(line.widthPx ?? 1)}"><a:solidFill>${color}</a:solidFill></a:ln>`;
}

function geometryXml(spec: ShapeSpec): string {
  if (spec.geometry !== "roundRect") return `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>`;

  const radius = spec.radiusPx ?? 4;
  const adjustment = Math.min(50000, Math.round((radius / Math.min(spec.width, spec.height)) * 100000));

  return `<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val ${adjustment}"/></a:avLst></a:prstGeom>`;
}

export function shapeXml(spec: ShapeSpec): string {
  const rect = clampRectToSlide(spec);

  return (
    `<p:sp><p:nvSpPr><p:cNvPr id="${spec.id}" name="${escapeHtml(spec.name)}"/>` +
    `<p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="${toEmu(rect.x)}" y="${toEmu(rect.y)}"/>` +
    `<a:ext cx="${toEmu(Math.max(1, rect.width))}" cy="${toEmu(Math.max(1, rect.height))}"/></a:xfrm>` +
    `${geometryXml(spec)}${fillXml(spec.fill)}${outlineXml(spec.line)}` +
    `<a:effectLst/></p:spPr></p:sp>`
  );
}

export interface PictureSpec {
  id: number;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Relationship id of the image part on this slide. */
  relId: string;
  /** Alternative text carried into PowerPoint. */
  description?: string;
}

/** A picture part placed on the slide, used by diagrams and image slides. */
export function pictureXml(spec: PictureSpec): string {
  const rect = clampRectToSlide(spec);
  const description = spec.description
    ? ` descr="${escapeHtml(spec.description)}"`
    : "";

  return (
    `<p:pic><p:nvPicPr><p:cNvPr id="${spec.id}" name="${escapeHtml(spec.name)}"${description}/>` +
    `<p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>` +
    `<p:blipFill><a:blip r:embed="${spec.relId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>` +
    `<p:spPr><a:xfrm><a:off x="${toEmu(rect.x)}" y="${toEmu(rect.y)}"/>` +
    `<a:ext cx="${toEmu(Math.max(1, rect.width))}" cy="${toEmu(Math.max(1, rect.height))}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`
  );
}

export interface BackgroundPicture {
  relId: string;
  pixelWidth: number;
  pixelHeight: number;
}

/** Crop percentages that make a picture cover a 16:9 slide without stretching. */
function coverCrop(width: number, height: number): { left: number; top: number; right: number; bottom: number } {
  const slideAspect = 1280 / 720;
  const imageAspect = width / Math.max(1, height);

  if (imageAspect > slideAspect) {
    const crop = (1 - slideAspect / imageAspect) / 2;
    return { left: crop, top: 0, right: crop, bottom: 0 };
  }

  const crop = (1 - imageAspect / slideAspect) / 2;
  return { left: 0, top: crop, right: 0, bottom: crop };
}

/** A bitmap cover image behind one slide, cropped like CSS `object-fit: cover`. */
export function slideImageBackgroundXml(picture: BackgroundPicture): string {
  const crop = coverCrop(picture.pixelWidth, picture.pixelHeight);
  const percent = (value: number): number => Math.round(value * 100000);

  return (
    `<p:bg><p:bgPr><a:blipFill><a:blip r:embed="${picture.relId}"/>` +
    `<a:srcRect l="${percent(crop.left)}" t="${percent(crop.top)}" ` +
    `r="${percent(crop.right)}" b="${percent(crop.bottom)}"/>` +
    `<a:stretch><a:fillRect/></a:stretch></a:blipFill><a:effectLst/></p:bgPr></p:bg>`
  );
}

/** A solid background for one slide, so exports keep the deck's own colours. */
export function slideBackgroundXml(fill: ShapeFill): string {
  return `<p:bg><p:bgPr>${fillXml(fill)}<a:effectLst/></p:bgPr></p:bg>`;
}

/** The shape tree every slide and layout needs before its own shapes. */
export const SHAPE_TREE_OPEN =
  `<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
  `<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>` +
  `<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>`;

export const SHAPE_TREE_CLOSE = `</p:spTree>`;
