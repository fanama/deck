import type { ContentPath } from "../../domain/deck/slideTypes.ts";

/**
 * In-place text editing. The preview provides this context; the exported deck
 * and the presenter never do, so the same slide components stay read-only
 * everywhere except in the studio.
 */
export interface SlideTextEditing {
  canEdit: () => boolean;
  /** Mostly strings; diagram links commit a whole list at their own path. */
  commit: (path: ContentPath, value: unknown) => void;
}

export const SLIDE_TEXT_EDITING = Symbol("slide-text-editing");
