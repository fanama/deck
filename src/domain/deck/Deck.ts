import {
  appendValueAtPath,
  moveValueAtPath,
  removeValueAtPath,
  withValueAtPath,
} from "../../shared/immutablePath.ts";
import {
  contrastRatio,
  createDeckTheme,
  DEFAULT_ACCENT_COLOR,
  normaliseHexColor,
  readableTextColor,
} from "./deckTheme.ts";
import {
  createDefaultContentForLayout,
  findSlideLayout,
  isKnownSlideLayout,
} from "./slideLayoutCatalog.ts";
import { normalizeSlideImage } from "./slideImage.ts";
import type {
  ContentPath,
  Deck,
  Slide,
  SlideContent,
  SlideImage,
  SlideLayoutId,
  SlideOf,
} from "./slideTypes.ts";

let fallbackIdCounter = 0;

function createId(prefix: string): string {
  const uniquePart = globalThis.crypto?.randomUUID?.() ?? `local-${Date.now()}-${fallbackIdCounter++}`;
  return `${prefix}_${uniquePart}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function touchDeck(deck: Deck): Deck {
  return { ...deck, updatedAt: new Date().toISOString() };
}

function replaceSlide(deck: Deck, updatedSlide: Slide): Deck {
  return touchDeck({
    ...deck,
    slides: deck.slides.map((slide) => (slide.id === updatedSlide.id ? updatedSlide : slide)),
  });
}

function replaceSlideContent(deck: Deck, slide: Slide, content: SlideContent): Deck {
  return replaceSlide(deck, { ...slide, content } as Slide);
}

export interface CreateDeckInput {
  title: string;
  footerLabel: string;
  accentColor?: string;
  backgroundColor?: string;
  textColor?: string;
  slides: Slide[];
}

export function createDeck({
  title,
  footerLabel,
  accentColor,
  backgroundColor,
  textColor,
  slides,
}: CreateDeckInput): Deck {
  return {
    id: createId("deck"),
    title,
    footerLabel,
    theme: createDeckTheme(
      accentColor ?? DEFAULT_ACCENT_COLOR,
      backgroundColor,
      textColor,
    ),
    slides,
    updatedAt: new Date().toISOString(),
  };
}

export function createBlankSlide<Layout extends SlideLayoutId>(layoutId: Layout): SlideOf<Layout> {
  const layout = findSlideLayout(layoutId);

  return {
    id: createId("slide"),
    layout: layout.id,
    content: createDefaultContentForLayout(layoutId),
  } as unknown as SlideOf<Layout>;
}

export function findSlideById(deck: Deck, slideId: string): Slide | null {
  return deck.slides.find((slide) => slide.id === slideId) ?? null;
}

export function findSlideIndexById(deck: Deck, slideId: string): number {
  return deck.slides.findIndex((slide) => slide.id === slideId);
}

export function updateDeckTitle(deck: Deck, title: string): Deck {
  return touchDeck({ ...deck, title });
}

export function updateDeckFooterLabel(deck: Deck, footerLabel: string): Deck {
  return touchDeck({ ...deck, footerLabel });
}

export function updateDeckAccentColor(deck: Deck, accentColor: string): Deck {
  return touchDeck({
    ...deck,
    theme: createDeckTheme(accentColor, deck.theme.backgroundColor, deck.theme.textColor),
  });
}

/** A new background keeps readable text when the current colour would vanish. */
export function updateDeckBackgroundColor(deck: Deck, backgroundColor: string): Deck {
  const background = normaliseHexColor(backgroundColor) ?? deck.theme.backgroundColor;
  const textColor =
    contrastRatio(background, deck.theme.textColor) >= 4.5
      ? deck.theme.textColor
      : readableTextColor(background);

  return touchDeck({
    ...deck,
    theme: createDeckTheme(deck.theme.accentColor, background, textColor),
  });
}

export function updateDeckTextColor(deck: Deck, textColor: string): Deck {
  return touchDeck({
    ...deck,
    theme: createDeckTheme(deck.theme.accentColor, deck.theme.backgroundColor, textColor),
  });
}

export function resetDeckTheme(deck: Deck): Deck {
  return touchDeck({ ...deck, theme: createDeckTheme(DEFAULT_ACCENT_COLOR) });
}

/** Sets or clears the decorative image behind one slide. */
export function setSlideBackgroundImage(
  deck: Deck,
  slideId: string,
  image: SlideImage | null,
): Deck {
  const slide = findSlideById(deck, slideId);
  if (!slide) return deck;

  const normalized = image ? normalizeSlideImage(image) : null;

  return replaceSlide(deck, {
    ...slide,
    backgroundImage: normalized ?? undefined,
  } as Slide);
}

export function insertSlideAfterSlide(deck: Deck, slide: Slide, afterSlideId: string): Deck {
  const afterIndex = findSlideIndexById(deck, afterSlideId);
  const insertIndex = afterIndex === -1 ? deck.slides.length : afterIndex + 1;

  return touchDeck({
    ...deck,
    slides: [...deck.slides.slice(0, insertIndex), slide, ...deck.slides.slice(insertIndex)],
  });
}

/**
 * A copy with a fresh id, safe to add to a library that already holds the
 * original (importing an exported deck a second time, for instance).
 */
export function duplicateDeck(deck: Deck): Deck {
  return touchDeck({ ...structuredClone(deck), id: createId("deck") });
}

export function duplicateSlideById(deck: Deck, slideId: string): Deck {
  const original = findSlideById(deck, slideId);
  if (!original) return deck;

  const copy = { ...structuredClone(original), id: createId("slide") } as Slide;
  return insertSlideAfterSlide(deck, copy, slideId);
}

/** Removes a slide, but never leaves the deck without one. */
export function removeSlideById(deck: Deck, slideId: string): Deck {
  if (deck.slides.length <= 1) return deck;

  return touchDeck({
    ...deck,
    slides: deck.slides.filter((slide) => slide.id !== slideId),
  });
}

export function moveSlideTo(deck: Deck, slideId: string, targetIndex: number): Deck {
  const fromIndex = findSlideIndexById(deck, slideId);
  if (fromIndex === -1) return deck;
  if (targetIndex < 0 || targetIndex >= deck.slides.length || targetIndex === fromIndex) return deck;

  const slides = deck.slides.slice();
  const movedSlide = slides.splice(fromIndex, 1)[0];
  if (!movedSlide) return deck;
  slides.splice(targetIndex, 0, movedSlide);

  return touchDeck({ ...deck, slides });
}

export function updateSlideContentAtPath(
  deck: Deck,
  slideId: string,
  path: ContentPath,
  value: unknown,
): Deck {
  const slide = findSlideById(deck, slideId);
  if (!slide) return deck;

  return replaceSlideContent(deck, slide, withValueAtPath(slide.content, path, value));
}

export function appendSlideContentItem(
  deck: Deck,
  slideId: string,
  listFieldPath: ContentPath,
  item: unknown,
): Deck {
  const slide = findSlideById(deck, slideId);
  if (!slide) return deck;

  return replaceSlideContent(deck, slide, appendValueAtPath(slide.content, listFieldPath, item));
}

export function removeSlideContentItem(
  deck: Deck,
  slideId: string,
  listFieldPath: ContentPath,
  index: number,
): Deck {
  const slide = findSlideById(deck, slideId);
  if (!slide) return deck;

  return replaceSlideContent(deck, slide, removeValueAtPath(slide.content, listFieldPath, index));
}

export function moveSlideContentItem(
  deck: Deck,
  slideId: string,
  listFieldPath: ContentPath,
  fromIndex: number,
  toIndex: number,
): Deck {
  const slide = findSlideById(deck, slideId);
  if (!slide) return deck;

  return replaceSlideContent(
    deck,
    slide,
    moveValueAtPath(slide.content, listFieldPath, fromIndex, toIndex),
  );
}

function mergeSlideContentWithDefaults(layoutId: SlideLayoutId, storedContent: unknown): SlideContent {
  const defaults = createDefaultContentForLayout(layoutId) as unknown as Record<string, unknown>;
  const stored = isRecord(storedContent) ? storedContent : {};
  const merged: Record<string, unknown> = { ...defaults };

  for (const [key, defaultValue] of Object.entries(defaults)) {
    const storedValue = stored[key];

    if (layoutId === "image" && key === "image") {
      merged[key] = normalizeSlideImage(storedValue);
      continue;
    }

    if (Array.isArray(defaultValue)) {
      merged[key] = Array.isArray(storedValue) ? storedValue : defaultValue;
      continue;
    }

    merged[key] = typeof defaultValue === "string" && typeof storedValue === "string" ? storedValue : defaultValue;
  }

  return merged as unknown as SlideContent;
}

/**
 * Rebuilds a deck from whatever was stored in the browser. Returns null when
 * the stored value cannot be trusted, so the caller can fall back to a fresh
 * deck instead of rendering a broken one.
 */
export function restoreDeckFromStoredValue(storedValue: unknown): Deck | null {
  if (!isRecord(storedValue) || !Array.isArray(storedValue.slides)) return null;

  const slides = storedValue.slides
    .filter(
      (slide): slide is Record<string, unknown> => isRecord(slide) && isKnownSlideLayout(slide.layout),
    )
    .map((slide): Slide => {
      const layout = slide.layout as SlideLayoutId;
      const backgroundImage = normalizeSlideImage(slide.backgroundImage);

      return {
        id: typeof slide.id === "string" ? slide.id : createId("slide"),
        layout,
        content: mergeSlideContentWithDefaults(layout, slide.content),
        ...(backgroundImage ? { backgroundImage } : {}),
      } as Slide;
    });

  if (slides.length === 0) return null;

  const storedTheme = isRecord(storedValue.theme) ? storedValue.theme : {};

  return {
    id: typeof storedValue.id === "string" ? storedValue.id : createId("deck"),
    title: typeof storedValue.title === "string" ? storedValue.title : "Untitled deck",
    footerLabel: typeof storedValue.footerLabel === "string" ? storedValue.footerLabel : "Untitled deck",
    theme: createDeckTheme(
      storedTheme.accentColor,
      storedTheme.backgroundColor,
      storedTheme.textColor,
    ),
    slides,
    updatedAt: typeof storedValue.updatedAt === "string" ? storedValue.updatedAt : new Date().toISOString(),
  };
}
