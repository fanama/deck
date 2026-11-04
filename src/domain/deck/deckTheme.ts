import type { DeckTheme } from "./slideTypes.ts";

export const DEFAULT_ACCENT_COLOR = "#0f6b64";

const TITLE_GRADIENT_START = "#0b1c22";
const TITLE_GRADIENT_END = "#0d2a34";

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

/**
 * The theme is the only visual input a deck carries. Tints are derived from
 * the accent so the studio preview and the exported file cannot disagree.
 */
export function createDeckTheme(accentColor: unknown): DeckTheme {
  return { accentColor: normaliseHexColor(accentColor) ?? DEFAULT_ACCENT_COLOR };
}

export function buildDeckThemeVariables(theme: DeckTheme | undefined): Record<string, string> {
  const accentColor = normaliseHexColor(theme?.accentColor) ?? DEFAULT_ACCENT_COLOR;

  return {
    "--accent": accentColor,
    "--accent-soft": mixHexColors("#ffffff", accentColor, 0.12),
    "--accent-line": mixHexColors("#ffffff", accentColor, 0.3),
    "--title-from": mixHexColors(accentColor, TITLE_GRADIENT_START, 0.62),
    "--title-to": mixHexColors(accentColor, TITLE_GRADIENT_END, 0.42),
  };
}

/** Turns a variable map into a CSS `style` attribute value. */
export function toStyleAttributeValue(variables: Record<string, string>): string {
  return Object.entries(variables)
    .map(([name, value]) => `${name}: ${value}`)
    .join("; ");
}
