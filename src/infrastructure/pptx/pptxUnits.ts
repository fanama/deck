import { buildDeckThemeVariables } from "../../domain/deck/deckTheme.ts";
import type { DeckTheme, SlideLayoutId } from "../../domain/deck/slideTypes.ts";

/**
 * A CSS px is 1/96 inch, so the 1280×720 authoring stage is exactly 13.333×7.5
 * inches — a standard 16:9 PowerPoint slide. Keeping that mapping means no
 * scaling, no letterboxing and geometry that matches the preview one to one.
 */
export const EMU_PER_PX = 9525;
export const SLIDE_WIDTH_PX = 1280;
export const SLIDE_HEIGHT_PX = 720;

/** CSS px → English Metric Units (1/914400 inch). */
export function toEmu(pixelValue: number): number {
  return Math.round(pixelValue * EMU_PER_PX);
}

/** CSS px → hundredths of a point, the unit `sz` uses (1 px = 0.75 pt). */
export function toHundredthsOfPoint(pixelValue: number): number {
  return Math.round(pixelValue * 75);
}

/** The area a layout may draw in, mirroring the padding in `deck.css`. */
export interface SlideFrame {
  x: number;
  width: number;
  top: number;
  /** Y of the content-box bottom, i.e. above the footer. */
  bottom: number;
}

export function frameForLayout(layout: SlideLayoutId): SlideFrame {
  const isCover = layout === "title" || layout === "closing";

  return isCover
    ? { x: 72, width: SLIDE_WIDTH_PX - 144, top: 64, bottom: SLIDE_HEIGHT_PX - 56 }
    : { x: 68, width: SLIDE_WIDTH_PX - 136, top: 52, bottom: SLIDE_HEIGHT_PX - 54 };
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Keeps a shape on the canvas. Content at the schema limits always fits, but a
 * deck restored from an older format can carry longer text, and a shape placed
 * off-slide would be invisible in PowerPoint instead of merely clipped.
 */
export function clampRectToSlide(rect: Rect): Rect {
  const width = Math.min(rect.width, SLIDE_WIDTH_PX);
  const height = Math.min(rect.height, SLIDE_HEIGHT_PX);

  return {
    width,
    height,
    x: Math.min(Math.max(rect.x, 0), SLIDE_WIDTH_PX - width),
    y: Math.min(Math.max(rect.y, 0), SLIDE_HEIGHT_PX - height),
  };
}

export interface Palette {
  accent: string;
  accentSoft: string;
  accentLine: string;
  titleFrom: string;
  titleTo: string;
  ink: string;
  inkSoft: string;
  muted: string;
  line: string;
  panel: string;
  card: string;
  paper: string;
  darkBackground: string;
  darkPanel: string;
  darkLine: string;
  darkText: string;
  darkMuted: string;
  darkMono: string;
}

const BASE_PALETTE = {
  ink: "12171F",
  inkSoft: "33404F",
  muted: "667485",
  line: "D9D6CF",
  panel: "FBFAF7",
  card: "FFFFFF",
  paper: "F6F4EF",
  darkBackground: "0F1B21",
  darkPanel: "17262C",
  darkLine: "333E44",
  darkText: "EEF4F3",
  darkMuted: "8FB6AE",
  darkMono: "9FD6CB",
} as const;

function withoutHash(color: string): string {
  return color.replace("#", "").toUpperCase();
}

/**
 * The palette is derived from the deck accent through the same helper the CSS
 * variables use, so the preview, the HTML export and the PPTX cannot disagree
 * about what the deck's accent implies.
 */
export function paletteForTheme(theme: DeckTheme | undefined): Palette {
  const variables = buildDeckThemeVariables(theme);

  return {
    ...BASE_PALETTE,
    accent: withoutHash(variables["--accent"]),
    accentSoft: withoutHash(variables["--accent-soft"]),
    accentLine: withoutHash(variables["--accent-line"]),
    titleFrom: withoutHash(variables["--title-from"]),
    titleTo: withoutHash(variables["--title-to"]),
  };
}
