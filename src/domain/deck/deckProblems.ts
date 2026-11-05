import { SLIDE_LAYOUTS } from "./slideLayoutCatalog.ts";
import type { ContentPath, Deck } from "./slideTypes.ts";

export const MAX_SLIDE_COUNT = 30;
export const MAX_HEADING_LENGTH = 90;
export const MAX_BLOCK_TEXT_LENGTH = 220;

export interface DeckProblem {
  severity: "error" | "warning";
  message: string;
}

interface LongBlockText {
  key: string;
  length: number;
  path: ContentPath;
}

const BLOCK_TEXT_KEYS = new Set(["body", "statement", "detail"]);

function collectLongBlockTexts(value: unknown, path: ContentPath, results: LongBlockText[]): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectLongBlockTexts(item, [...path, index], results));
    return;
  }

  if (!value || typeof value !== "object") return;

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (typeof child === "string" && BLOCK_TEXT_KEYS.has(key) && child.length > MAX_BLOCK_TEXT_LENGTH) {
      results.push({ key, length: child.length, path: [...path, key] });
    } else if (typeof child === "object") {
      collectLongBlockTexts(child, [...path, key], results);
    }
  }
}

/**
 * Collects every problem the deck has right now. Errors block the export;
 * warnings are things the deck can still say but that will read badly on a
 * projector.
 */
export function findDeckProblems(deck: Deck): DeckProblem[] {
  const problems: DeckProblem[] = [];

  if (!deck.title.trim()) {
    problems.push({ severity: "error", message: "The deck needs a title; it becomes the exported file name." });
  }

  if (deck.footerLabel.length > 60) {
    problems.push({ severity: "warning", message: "The footer label is long; it will crowd the page number." });
  }

  if (deck.slides.length > MAX_SLIDE_COUNT) {
    problems.push({
      severity: "warning",
      message: `${deck.slides.length} slides is past the ${MAX_SLIDE_COUNT}-slide guide; consider splitting the deck.`,
    });
  }

  deck.slides.forEach((slide, index) => {
    const slideNumber = index + 1;
    const layout = SLIDE_LAYOUTS.find((candidate) => candidate.id === slide.layout);
    const layoutLabel = layout ? layout.label : slide.layout;

    if (!slide.content.heading.trim()) {
      problems.push({ severity: "error", message: `Slide ${slideNumber} (${layoutLabel}): the heading is empty.` });
    }

    if (slide.content.heading.length > MAX_HEADING_LENGTH) {
      problems.push({
        severity: "warning",
        message: `Slide ${slideNumber}: the heading is ${slide.content.heading.length} characters; keep it under ${MAX_HEADING_LENGTH}.`,
      });
    }

    if (slide.layout === "diagram" && slide.content.boxes.length === 0) {
      problems.push({
        severity: "warning",
        message: `Slide ${slideNumber} (${layoutLabel}): the diagram has no boxes.`,
      });
    }

    const longBlockTexts: LongBlockText[] = [];
    collectLongBlockTexts(slide.content, [], longBlockTexts);

    for (const longText of longBlockTexts) {
      problems.push({
        severity: "warning",
        message: `Slide ${slideNumber}: a "${longText.key}" block is ${longText.length} characters; ${MAX_BLOCK_TEXT_LENGTH} is the readable limit.`,
      });
    }
  });

  return problems;
}

export function hasBlockingProblems(problems: DeckProblem[]): boolean {
  return problems.some((problem) => problem.severity === "error");
}
