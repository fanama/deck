import type { DeckTheme } from "./slideTypes.ts";

export const DEFAULT_ACCENT_COLOR = "#0f6b64";
export const DEFAULT_BACKGROUND_COLOR = "#ffffff";
export const DEFAULT_TEXT_COLOR = "#12171f";

const TITLE_GRADIENT_START = "#0b1c22";
const TITLE_GRADIENT_END = "#0d2a34";
const WARM_COLOR = "#b45309";

/** Returns a #rrggbb colour, or null when the input is not a hex colour. */
export function normaliseHexColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const hex = value.trim().replace(/^#/, "");

  if (/^[0-9a-f]{3}$/i.test(hex)) {
    return `#${hex
      .split("")
      .map((character) => character + character)
      .join("")}`.toLowerCase();
  }

  if (/^[0-9a-f]{6}$/i.test(hex)) return `#${hex.toLowerCase()}`;
  return null;
}

interface ColorChannels {
  red: number;
  green: number;
  blue: number;
}

function hexColorToChannels(hexColor: string): ColorChannels {
  const hex = hexColor.replace("#", "");
  return {
    red: Number.parseInt(hex.slice(0, 2), 16),
    green: Number.parseInt(hex.slice(2, 4), 16),
    blue: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function channelsToHexColor({ red, green, blue }: ColorChannels): string {
  return `#${[red, green, blue].map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`;
}

/** Mixes two hex colours; amount 0 returns fromHex, amount 1 returns toHex. */
export function mixHexColors(fromHex: string, toHex: string, amount: number): string {
  const from = hexColorToChannels(fromHex);
  const to = hexColorToChannels(toHex);
  const ratio = Math.min(1, Math.max(0, amount));

  return channelsToHexColor({
    red: from.red + (to.red - from.red) * ratio,
    green: from.green + (to.green - from.green) * ratio,
    blue: from.blue + (to.blue - from.blue) * ratio,
  });
}

function linearChannel(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hexColor: string): number {
  const { red, green, blue } = hexColorToChannels(hexColor);
  return 0.2126 * linearChannel(red) + 0.7152 * linearChannel(green) + 0.0722 * linearChannel(blue);
}

/** WCAG contrast ratio, from 1 (identical) to 21 (black on white). */
export function contrastRatio(firstHex: string, secondHex: string): number {
  const first = relativeLuminance(firstHex);
  const second = relativeLuminance(secondHex);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);

  return (lighter + 0.05) / (darker + 0.05);
}

/** Picks ink or white, whichever reads better on the supplied background. */
export function readableTextColor(backgroundColor: string): string {
  return contrastRatio(backgroundColor, "#ffffff") > contrastRatio(backgroundColor, DEFAULT_TEXT_COLOR)
    ? "#ffffff"
    : DEFAULT_TEXT_COLOR;
}

/**
 * The theme is the only visual input a deck carries. Tints are derived from the
 * accent, background and text so the studio preview and the exported file
 * cannot disagree.
 */
export function createDeckTheme(
  accentColor: unknown,
  backgroundColor?: unknown,
  textColor?: unknown,
): DeckTheme {
  const background = normaliseHexColor(backgroundColor) ?? DEFAULT_BACKGROUND_COLOR;

  return {
    accentColor: normaliseHexColor(accentColor) ?? DEFAULT_ACCENT_COLOR,
    backgroundColor: background,
    textColor: normaliseHexColor(textColor) ?? readableTextColor(background),
  };
}

export function buildDeckThemeVariables(theme: DeckTheme | undefined): Record<string, string> {
  const accentColor = normaliseHexColor(theme?.accentColor) ?? DEFAULT_ACCENT_COLOR;
  const backgroundColor = normaliseHexColor(theme?.backgroundColor) ?? DEFAULT_BACKGROUND_COLOR;
  const textColor = normaliseHexColor(theme?.textColor) ?? readableTextColor(backgroundColor);
  const isDarkPaper = relativeLuminance(backgroundColor) < 0.4;

  return {
    "--ink": textColor,
    "--ink-soft": mixHexColors(textColor, backgroundColor, 0.18),
    "--muted": mixHexColors(textColor, backgroundColor, 0.4),
    "--line": mixHexColors(textColor, backgroundColor, 0.84),
    "--paper": backgroundColor,
    "--card": backgroundColor,
    "--panel": mixHexColors(backgroundColor, textColor, 0.035),
    "--accent": accentColor,
    "--accent-soft": mixHexColors(backgroundColor, accentColor, 0.12),
    "--accent-line": mixHexColors(backgroundColor, accentColor, 0.3),
    "--title-from": mixHexColors(accentColor, TITLE_GRADIENT_START, 0.62),
    "--title-to": mixHexColors(accentColor, TITLE_GRADIENT_END, 0.42),
    "--warm": isDarkPaper ? mixHexColors(WARM_COLOR, "#ffffff", 0.35) : WARM_COLOR,
    "--warm-soft": mixHexColors(backgroundColor, WARM_COLOR, 0.12),
  };
}

/** Diagram fills and strokes use the same resolved theme as the stylesheet. */
export function buildDiagramThemeColors(theme: DeckTheme | undefined): {
  accent: string;
  ink: string;
  muted: string;
  warm: string;
  paper: string;
  onAccent: string;
} {
  const variables = buildDeckThemeVariables(theme);

  return {
    accent: variables["--accent"],
    ink: variables["--ink"],
    muted: variables["--muted"],
    warm: variables["--warm"],
    paper: variables["--paper"],
    onAccent: readableTextColor(variables["--accent"]),
  };
}

/** Turns a variable map into a CSS `style` attribute value. */
export function toStyleAttributeValue(variables: Record<string, string>): string {
  return Object.entries(variables)
    .map(([name, value]) => `${name}: ${value}`)
    .join("; ");
}
