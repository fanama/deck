import { createNewDeck, createStarterDeck } from "../../application/createStarterDeck.ts";
import { exportDeckAsHtmlFile } from "../../application/exportDeckAsHtmlFile.ts";
import { exportDeckAsPptxFile } from "../../application/exportDeckAsPptxFile.ts";
import { loadSavedLibrary } from "../../application/loadSavedDecks.ts";
import { parseDeckFileText } from "../../application/parseDeckFileText.ts";
import { saveDeckLibrary } from "../../application/saveDeckLibrary.ts";
import {
  appendSlideContentItem,
  createBlankSlide,
  duplicateDeck,
  duplicateSlideById,
  findSlideById,
  findSlideIndexById,
  insertSlideAfterSlide,
  moveSlideContentItem,
  moveSlideTo,
  removeSlideById,
  removeSlideContentItem,
  updateDeckAccentColor,
  updateDeckFooterLabel,
  updateDeckTitle,
  updateSlideContentAtPath,
} from "../../domain/deck/Deck.ts";
import { findDeckProblems } from "../../domain/deck/deckProblems.ts";
import { createEmptyListItem, findSlideLayout } from "../../domain/deck/slideLayoutCatalog.ts";
import type {
  ContentPath,
  Deck,
  DiagramBox,
  DiagramLink,
  DiagramRouting,
  DiagramSlideContent,
  Slide,
  SlideLayoutId,
} from "../../domain/deck/slideTypes.ts";
import type { DeckLibrary, DeckRepository } from "../../domain/ports/deckRepositoryPort.ts";
import {
  createDiagramGroupId,
  diagramBoxMinSize,
  DIAGRAM_HEIGHT,
  DIAGRAM_WIDTH,
  diagramShapeSize,
  normalizeDiagramBoxes,
} from "../../shared/diagramSvg.ts";
import { downloadBinaryFile } from "../../infrastructure/browser/downloadBinaryFile.ts";
import { rasteriseSvgToPng } from "../../infrastructure/browser/rasteriseSvgToPng.ts";
import { enterFullscreen, exitFullscreen } from "../../infrastructure/browser/fullscreen.ts";
import { downloadTextFile } from "../../infrastructure/browser/downloadTextFile.ts";
import { createHtmlDeckExporter } from "../../infrastructure/export/htmlDeckExporter.ts";
import { createLocalStorageDeckRepository } from "../../infrastructure/persistence/localStorageDeckRepository.ts";
import { createPptxDeckExporter } from "../../infrastructure/pptx/pptxDeckExporter.ts";

export interface StudioNotice {
  kind: "success" | "error";
  message: string;
}

/** One step of diagram-only undo: the slide's drawing before a change. */
export interface DiagramHistoryEntry {
  slideId: string;
  boxes: DiagramBox[];
  links: DiagramLink[];
  routing: DiagramRouting;
}

/** A typed width/height may not go below what the node's content needs. */
function clampDiagramDimension(
  box: DiagramBox,
  dimension: "width" | "height",
  value: unknown,
): unknown {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(parsed)) return value;

  const minimum = diagramBoxMinSize(box);
  const maximum = dimension === "width" ? DIAGRAM_WIDTH - box.x : DIAGRAM_HEIGHT - box.y;

  return Math.min(Math.max(Math.round(parsed), minimum[dimension]), maximum);
}

const deckRepository: DeckRepository = createLocalStorageDeckRepository();
const deckExporter = createHtmlDeckExporter();
const pptxExporter = createPptxDeckExporter({ rasteriseSvg: rasteriseSvgToPng });

const savedLibrary = loadSavedLibrary(deckRepository);
const initialDecks: Deck[] = savedLibrary ? savedLibrary.decks : [createStarterDeck()];
const initialDeck: Deck =
  initialDecks.find((deck) => deck.id === savedLibrary?.activeDeckId) ?? initialDecks[0] ?? createStarterDeck();

/**
 * The studio's presentation state. It owns the current deck, the selection,
 * autosave and the notice bar; every slide change is delegated to the domain
 * so this class never edits deck data itself.
 */
export class PresentationStudio {
  decks = $state<Deck[]>(initialDecks);
  deck = $state<Deck>(initialDeck);
  selectedSlideId = $state<string>(initialDeck.slides[0]?.id ?? "");
  isSaved = $state<boolean>(savedLibrary !== null);
  notice = $state<StudioNotice | null>(null);
  isPresenting = $state<boolean>(false);
  selectedDiagramBoxId = $state<string | null>(null);
  selectedDiagramBoxIds = $state<string[]>([]);
  undoStack = $state<DiagramHistoryEntry[]>([]);
  redoStack = $state<DiagramHistoryEntry[]>([]);
  private lastDiagramHistoryPath: string | null = null;
  private lastDiagramHistoryAt = 0;

  selectedSlide = $derived(
    findSlideById(this.deck, this.selectedSlideId) ?? this.deck.slides[0] ?? null,
  );

  selectedSlideIndex = $derived(
    Math.max(0, findSlideIndexById(this.deck, this.selectedSlide?.id ?? "")),
  );

  selectedSlideLayout = $derived(findSlideLayout(this.selectedSlide?.layout ?? "title"));

  problems = $derived(findDeckProblems(this.deck));

  canDeleteSelectedSlide = $derived(this.deck.slides.length > 1);

  canUndoDiagramEdit = $derived(this.undoStack.length > 0);

  canRedoDiagramEdit = $derived(this.redoStack.length > 0);

  selectedDiagramBox = $derived.by(() => {
    const slide = this.selectedSlide;
    if (!slide || slide.layout !== "diagram" || !this.selectedDiagramBoxId) return null;

    return slide.content.boxes.find((box) => box.id === this.selectedDiagramBoxId) ?? null;
  });

  selectedDiagramGroupId = $derived(this.selectedDiagramBox?.groupId ?? null);

  canGroupSelectedDiagramBoxes = $derived(this.selectedDiagramBoxIds.length > 1);

  selectSlide(slideId: string): void {
    this.selectedSlideId = slideId;

    const slide = findSlideById(this.deck, slideId);
    const existing = new Set(
      slide?.layout === "diagram" ? slide.content.boxes.map((box) => box.id) : [],
    );

    this.selectedDiagramBoxIds = this.selectedDiagramBoxIds.filter((id) => existing.has(id));
    this.selectedDiagramBoxId =
      this.selectedDiagramBoxIds[this.selectedDiagramBoxIds.length - 1] ?? null;
  }

  selectDiagramBox(boxId: string | null, additive = false): void {
    if (!boxId) {
      this.clearDiagramSelection();
      return;
    }

    if (!additive) {
      this.selectedDiagramBoxId = boxId;
      this.selectedDiagramBoxIds = [boxId];
      return;
    }

    const wasSelected = this.selectedDiagramBoxIds.includes(boxId);
    this.selectedDiagramBoxIds = wasSelected
      ? this.selectedDiagramBoxIds.filter((id) => id !== boxId)
      : [...this.selectedDiagramBoxIds, boxId];
    this.selectedDiagramBoxId = wasSelected
      ? (this.selectedDiagramBoxIds[this.selectedDiagramBoxIds.length - 1] ?? null)
      : boxId;
  }

  clearDiagramSelection(): void {
    this.selectedDiagramBoxId = null;
    this.selectedDiagramBoxIds = [];
  }

  /** Switches the open deck; the library keeps the other ones untouched. */
  selectDeck(deckId: string): void {
    if (deckId === this.deck.id) return;

    this.syncActiveDeck();
    const target = this.decks.find((deck) => deck.id === deckId);
    if (!target) return;

    this.deck = target;
    this.selectedSlideId = target.slides[0]?.id ?? "";
    this.clearDiagramSelection();
    this.resetDiagramHistory();
    this.isSaved = false;
    this.notice = null;
  }

  /** Removes one deck; the library always keeps at least one. */
  deleteDeck(deckId: string): void {
    if (this.decks.length <= 1) {
      this.showNotice("error", "A library keeps at least one deck; add another one before deleting this one.");
      return;
    }

    const removed = this.decks.find((deck) => deck.id === deckId);
    if (!removed) return;

    this.decks = this.decks.filter((deck) => deck.id !== deckId);

    if (this.deck.id === deckId) {
      const nextDeck = this.decks[0];
      if (nextDeck) {
        this.deck = nextDeck;
        this.selectedSlideId = nextDeck.slides[0]?.id ?? "";
        this.clearDiagramSelection();
        this.resetDiagramHistory();
      }
    }

    this.isSaved = false;
    this.showNotice("success", `Removed “${removed.title || "Untitled deck"}”.`);
  }

  openSlideAt(index: number): void {
    const { slides } = this.deck;
    if (slides.length === 0) return;

    const normalisedIndex = ((index % slides.length) + slides.length) % slides.length;
    this.selectSlide(slides[normalisedIndex].id);
  }

  openNextSlide(): void {
    this.openSlideAt(this.selectedSlideIndex + 1);
  }

  openPreviousSlide(): void {
    this.openSlideAt(this.selectedSlideIndex - 1);
  }

  openFirstSlide(): void {
    this.openSlideAt(0);
  }

  openLastSlide(): void {
    this.openSlideAt(this.deck.slides.length - 1);
  }

  startPresenting(): void {
    this.isPresenting = true;
    void enterFullscreen();
  }

  stopPresenting(): void {
    this.isPresenting = false;
    void exitFullscreen();
  }

  addSlideWithLayout(layoutId: SlideLayoutId): void {
    const slide: Slide = createBlankSlide(layoutId);
    this.deck = insertSlideAfterSlide(this.deck, slide, this.selectedSlideId);
    this.clearDiagramSelection();
    this.selectSlide(slide.id);
    this.markChanged();
  }

  duplicateSlide(slideId: string): void {
    const sourceIndex = findSlideIndexById(this.deck, slideId);
    if (sourceIndex === -1) return;

    this.deck = duplicateSlideById(this.deck, slideId);
    const duplicatedSlide = this.deck.slides[sourceIndex + 1];
    this.clearDiagramSelection();
    if (duplicatedSlide) this.selectSlide(duplicatedSlide.id);
    this.markChanged();
  }

  deleteSlide(slideId: string): void {
    if (!this.canDeleteSelectedSlide) return;

    const removedIndex = findSlideIndexById(this.deck, slideId);
    this.deck = removeSlideById(this.deck, slideId);
    const nextSlide = this.deck.slides[Math.min(removedIndex, this.deck.slides.length - 1)];
    this.clearDiagramSelection();
    if (nextSlide) this.selectSlide(nextSlide.id);
    this.markChanged();
  }

  moveSlideUp(slideId: string): void {
    this.moveSlideToIndex(slideId, findSlideIndexById(this.deck, slideId) - 1);
  }

  moveSlideDown(slideId: string): void {
    this.moveSlideToIndex(slideId, findSlideIndexById(this.deck, slideId) + 1);
  }

  moveSlideToIndex(slideId: string, targetIndex: number): void {
    this.deck = moveSlideTo(this.deck, slideId, targetIndex);
    this.markChanged();
  }

  changeDeckTitle(title: string): void {
    this.deck = updateDeckTitle(this.deck, title);
    this.markChanged();
  }

  changeFooterLabel(footerLabel: string): void {
    this.deck = updateDeckFooterLabel(this.deck, footerLabel);
    this.markChanged();
  }

  changeAccentColor(accentColor: string): void {
    this.deck = updateDeckAccentColor(this.deck, accentColor);
    this.markChanged();
  }

  updateSlideField(path: ContentPath, value: unknown): void {
    const slide = this.selectedSlide;
    if (!slide) return;

    const isDiagramEdit =
      slide.layout === "diagram" && (path[0] === "boxes" || path[0] === "links");
    if (isDiagramEdit) this.pushDiagramHistory(path);

    const nextValue =
      slide.layout === "diagram" ? this.clampDiagramField(slide.content, path, value) : value;
    let deck = updateSlideContentAtPath(this.deck, slide.id, path, nextValue);
    if (slide.layout === "diagram") deck = this.normalizeDiagramContent(deck, slide.id);

    this.deck = deck;
    this.markChanged();
  }

  /** Moves one or more boxes; the preview works out the shared offset. */
  moveDiagramBoxes(
    updates: ReadonlyArray<{ index: number; x: number; y: number }>,
    nest?: { boxId: string; parentId: string | null },
  ): void {
    const slide = this.selectedSlide;
    if (!slide || slide.layout !== "diagram") return;
    if (updates.length === 0 && !nest) return;

    this.pushDiagramHistory();
    let deck = this.deck;

    for (const update of updates) {
      deck = updateSlideContentAtPath(deck, slide.id, ["boxes", update.index, "x"], update.x);
      deck = updateSlideContentAtPath(deck, slide.id, ["boxes", update.index, "y"], update.y);
    }

    if (nest) {
      const index = slide.content.boxes.findIndex((box) => box.id === nest.boxId);
      if (index >= 0) {
        deck = updateSlideContentAtPath(
          deck,
          slide.id,
          ["boxes", index, "parentId"],
          nest.parentId,
        );
      }
    }

    this.deck = this.normalizeDiagramContent(deck, slide.id);
    this.markChanged();
  }

  /** Commits a corner resize; the preview clamps and rounds before calling. */
  resizeDiagramBox(
    boxIndex: number,
    rect: { x: number; y: number; width: number; height: number },
  ): void {
    const slide = this.selectedSlide;
    if (!slide || slide.layout !== "diagram") return;

    this.pushDiagramHistory();
    let deck = updateSlideContentAtPath(this.deck, slide.id, ["boxes", boxIndex, "x"], rect.x);
    deck = updateSlideContentAtPath(deck, slide.id, ["boxes", boxIndex, "y"], rect.y);
    deck = updateSlideContentAtPath(deck, slide.id, ["boxes", boxIndex, "width"], rect.width);
    deck = updateSlideContentAtPath(deck, slide.id, ["boxes", boxIndex, "height"], rect.height);

    const boxId = slide.content.boxes[boxIndex]?.id ?? "";
    this.deck = this.clampDiagramChildren(
      this.normalizeDiagramContent(deck, slide.id),
      slide.id,
      boxId,
    );
    this.markChanged();
  }

  /** Boxes sharing a group id travel together; the selection seeds a new group. */
  groupSelectedDiagramBoxes(): void {
    const slide = this.selectedSlide;
    if (!slide || slide.layout !== "diagram" || this.selectedDiagramBoxIds.length < 2) return;

    this.pushDiagramHistory();
    const groupId = createDiagramGroupId();
    const selected = new Set(this.selectedDiagramBoxIds);
    let deck = this.deck;

    slide.content.boxes.forEach((box, index) => {
      if (!selected.has(box.id)) return;
      deck = updateSlideContentAtPath(deck, slide.id, ["boxes", index, "groupId"], groupId);
    });

    this.deck = this.normalizeDiagramContent(deck, slide.id);
    this.markChanged();
  }

  /** Splits every group represented in the current selection. */
  ungroupSelectedDiagramBoxes(): void {
    const slide = this.selectedSlide;
    if (!slide || slide.layout !== "diagram") return;

    const selected = new Set(this.selectedDiagramBoxIds);
    const groupIds = new Set(
      slide.content.boxes
        .filter((box) => selected.has(box.id) && box.groupId)
        .map((box) => box.groupId as string),
    );
    if (groupIds.size === 0) return;

    this.pushDiagramHistory();
    let deck = this.deck;

    slide.content.boxes.forEach((box, index) => {
      if (!box.groupId || !groupIds.has(box.groupId)) return;
      deck = updateSlideContentAtPath(deck, slide.id, ["boxes", index, "groupId"], undefined);
    });

    this.deck = this.normalizeDiagramContent(deck, slide.id);
    this.markChanged();
  }

  undoDiagramEdit(): void {
    const entry = this.undoStack[this.undoStack.length - 1];
    if (!entry) return;

    const current = this.diagramHistoryEntry(entry.slideId);
    if (!current) return;

    this.undoStack = this.undoStack.slice(0, -1);
    this.redoStack = [...this.redoStack, current];
    this.restoreDiagramHistoryEntry(entry);
  }

  redoDiagramEdit(): void {
    const entry = this.redoStack[this.redoStack.length - 1];
    if (!entry) return;

    const current = this.diagramHistoryEntry(entry.slideId);
    if (!current) return;

    this.redoStack = this.redoStack.slice(0, -1);
    this.undoStack = [...this.undoStack, current].slice(-50);
    this.restoreDiagramHistoryEntry(entry);
  }

  appendSlideListItem(listFieldPath: ContentPath): void {
    const slide = this.selectedSlide;
    if (!slide) return;

    if (slide.layout === "diagram" && listFieldPath[0] === "boxes") this.pushDiagramHistory(listFieldPath);

    const emptyItem = createEmptyListItem(slide.layout, listFieldPath);
    let deck = appendSlideContentItem(this.deck, slide.id, listFieldPath, emptyItem);
    if (slide.layout === "diagram") deck = this.normalizeDiagramContent(deck, slide.id);

    this.deck = deck;
    this.markChanged();
  }

  removeSlideListItem(listFieldPath: ContentPath, index: number): void {
    const slide = this.selectedSlide;
    if (!slide) return;

    if (slide.layout === "diagram" && listFieldPath[0] === "boxes") this.pushDiagramHistory(listFieldPath);

    let deck = removeSlideContentItem(this.deck, slide.id, listFieldPath, index);
    if (slide.layout === "diagram") deck = this.normalizeDiagramContent(deck, slide.id);

    this.deck = deck;
    this.markChanged();
  }

  moveSlideListItem(listFieldPath: ContentPath, fromIndex: number, toIndex: number): void {
    const slide = this.selectedSlide;
    if (!slide) return;

    if (slide.layout === "diagram" && listFieldPath[0] === "boxes") this.pushDiagramHistory(listFieldPath);

    let deck = moveSlideContentItem(this.deck, slide.id, listFieldPath, fromIndex, toIndex);
    if (slide.layout === "diagram") deck = this.normalizeDiagramContent(deck, slide.id);

    this.deck = deck;
    this.markChanged();
  }

  /** Adds a fresh deck to the library and opens it; the others are kept. */
  startNewDeck(): void {
    const deck = createNewDeck(`Untitled deck ${this.decks.length + 1}`);
    this.decks = [...this.decks, deck];
    this.deck = deck;
    this.clearDiagramSelection();
    this.resetDiagramHistory();
    this.selectSlide(deck.slides[0]?.id ?? "");
    this.markChanged();
    this.showNotice("success", "Added a new deck; the others stay in the library.");
  }

  importDeckFromText(fileText: string): void {
    const parsed = parseDeckFileText(fileText);

    if (!parsed.ok) {
      this.showNotice("error", parsed.message);
      return;
    }

    const slideCount = parsed.deck.slides.length;
    // A deck imported twice would collide on its id, so the second copy gets a new one.
    const imported = this.decks.some((deck) => deck.id === parsed.deck.id)
      ? duplicateDeck(parsed.deck)
      : parsed.deck;

    this.decks = [...this.decks, imported];
    this.deck = imported;
    this.clearDiagramSelection();
    this.resetDiagramHistory();
    this.selectSlide(imported.slides[0]?.id ?? "");
    this.markChanged();
    this.showNotice(
      "success",
      `Imported ${imported.title} — ${slideCount} slide${slideCount === 1 ? "" : "s"} added to the library.`,
    );
  }

  saveLibrarySnapshot(library: DeckLibrary): void {
    const result = saveDeckLibrary(deckRepository, library);

    if (result.ok) {
      this.isSaved = true;
      return;
    }

    this.showNotice("error", result.message);
  }

  saveNow(): void {
    this.syncActiveDeck();
    const library = $state.snapshot({
      decks: this.decks,
      activeDeckId: this.deck.id,
    }) as DeckLibrary;
    const result = saveDeckLibrary(deckRepository, library);

    if (!result.ok) {
      this.showNotice("error", result.message);
      return;
    }

    this.isSaved = true;
    this.showNotice("success", "Deck library saved in this browser.");
  }

  exportCurrentDeck(): void {
    const result = exportDeckAsHtmlFile({
      deckExporter,
      deck: $state.snapshot(this.deck),
    });

    if (!result.ok) {
      this.showNotice("error", "Fix the blocking problems in the inspector before exporting.");
      return;
    }

    downloadTextFile({ fileName: result.fileName, text: result.html, mimeType: "text/html" });
    this.showNotice("success", `Exported ${result.fileName} — one file, no dependencies.`);
  }

  async exportCurrentDeckAsPptx(): Promise<void> {
    try {
      const result = await exportDeckAsPptxFile({
        deckPptxExporter: pptxExporter,
        deck: $state.snapshot(this.deck),
      });

      if (!result.ok) {
        this.showNotice("error", "Fix the blocking problems in the inspector before exporting.");
        return;
      }

      downloadBinaryFile({
        fileName: result.fileName,
        bytes: result.bytes,
        mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      });
      this.showNotice("success", `Exported ${result.fileName} — editable text and shapes.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.showNotice("error", `The PPTX could not be written: ${message}`);
    }
  }

  showNotice(kind: StudioNotice["kind"], message: string): void {
    this.notice = { kind, message };
  }

  dismissNotice(): void {
    this.notice = null;
  }

  markChanged(): void {
    this.syncActiveDeck();
    this.isSaved = false;
  }

  /** Snapshot of a diagram slide, used as one undo step. */
  private diagramHistoryEntry(slideId: string): DiagramHistoryEntry | null {
    const slide = findSlideById(this.deck, slideId);
    if (!slide || slide.layout !== "diagram") return null;

    // The live content is a Svelte state proxy, which structuredClone rejects.
    const snapshot = $state.snapshot({
      boxes: slide.content.boxes,
      links: slide.content.links,
    });

    return {
      slideId,
      boxes: snapshot.boxes,
      links: snapshot.links,
      routing: slide.content.routing,
    };
  }

  /**
   * Pushes the state before a diagram change. Consecutive edits to the same
   * field within 500ms collapse into one step, so typing a title is one undo.
   */
  private pushDiagramHistory(path?: ContentPath): void {
    const slide = this.selectedSlide;
    if (!slide || slide.layout !== "diagram") return;

    const entry = this.diagramHistoryEntry(slide.id);
    if (!entry) return;

    const key = path ? path.join(".") : null;
    const now = Date.now();

    if (key !== null && key === this.lastDiagramHistoryPath && now - this.lastDiagramHistoryAt < 500) {
      this.lastDiagramHistoryAt = now;
      this.redoStack = [];
      return;
    }

    this.lastDiagramHistoryPath = key;
    this.lastDiagramHistoryAt = now;
    this.undoStack = [...this.undoStack, entry].slice(-50);
    this.redoStack = [];
  }

  private restoreDiagramHistoryEntry(entry: DiagramHistoryEntry): void {
    let deck = updateSlideContentAtPath(this.deck, entry.slideId, ["boxes"], $state.snapshot(entry.boxes));
    deck = updateSlideContentAtPath(deck, entry.slideId, ["links"], $state.snapshot(entry.links));
    deck = updateSlideContentAtPath(deck, entry.slideId, ["routing"], entry.routing);

    this.deck = deck;
    this.selectedSlideId = entry.slideId;
    this.clearDiagramSelection();
    this.markChanged();
  }

  private resetDiagramHistory(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.lastDiagramHistoryPath = null;
    this.lastDiagramHistoryAt = 0;
  }

  /** After a container shrinks, its direct children stay within its edges. */
  private clampDiagramChildren(deck: Deck, slideId: string, parentId: string): Deck {
    const slide = findSlideById(deck, slideId);
    if (!slide || slide.layout !== "diagram" || !parentId) return deck;

    const parent = slide.content.boxes.find((box) => box.id === parentId);
    if (!parent) return deck;

    const parentSize = diagramShapeSize(parent);
    let next = deck;

    slide.content.boxes.forEach((box, index) => {
      if (box.parentId !== parentId) return;

      const size = diagramShapeSize(box);
      const maxX = Math.max(parent.x, parent.x + parentSize.width - size.width);
      const maxY = Math.max(parent.y, parent.y + parentSize.height - size.height);
      const x = Math.min(Math.max(box.x, parent.x), maxX);
      const y = Math.min(Math.max(box.y, parent.y), maxY);

      if (x === box.x && y === box.y) return;
      next = updateSlideContentAtPath(next, slideId, ["boxes", index, "x"], x);
      next = updateSlideContentAtPath(next, slideId, ["boxes", index, "y"], y);
    });

    return next;
  }

  /** Keeps stored sizes honest after a field row is added or removed. */
  private normalizeDiagramContent(deck: Deck, slideId: string): Deck {
    const slide = findSlideById(deck, slideId);
    if (!slide || slide.layout !== "diagram") return deck;

    return updateSlideContentAtPath(deck, slideId, ["boxes"], normalizeDiagramBoxes(slide.content.boxes));
  }

  private clampDiagramField(
    content: DiagramSlideContent,
    path: ContentPath,
    value: unknown,
  ): unknown {
    if (path.length === 3 && path[0] === "boxes" && typeof path[1] === "number") {
      const dimension = path[2];
      const box = content.boxes[path[1]];

      if (box && (dimension === "width" || dimension === "height")) {
        return clampDiagramDimension(box, dimension, value);
      }
    }

    return value;
  }

  /** Mirrors the open deck into the library so the list and the save see it. */
  private syncActiveDeck(): void {
    const snapshot = $state.snapshot(this.deck) as Deck;
    const index = this.decks.findIndex((deck) => deck.id === snapshot.id);

    if (index === -1) this.decks = [...this.decks, snapshot];
    else this.decks[index] = snapshot;
  }
}
