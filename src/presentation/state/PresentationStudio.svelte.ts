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
import type { ContentPath, Deck, Slide, SlideLayoutId } from "../../domain/deck/slideTypes.ts";
import type { DeckLibrary, DeckRepository } from "../../domain/ports/deckRepositoryPort.ts";
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

  selectedSlide = $derived(
    findSlideById(this.deck, this.selectedSlideId) ?? this.deck.slides[0] ?? null,
  );

  selectedSlideIndex = $derived(
    Math.max(0, findSlideIndexById(this.deck, this.selectedSlide?.id ?? "")),
  );

  selectedSlideLayout = $derived(findSlideLayout(this.selectedSlide?.layout ?? "title"));

  problems = $derived(findDeckProblems(this.deck));

  canDeleteSelectedSlide = $derived(this.deck.slides.length > 1);

  selectSlide(slideId: string): void {
    this.selectedSlideId = slideId;
  }

  /** Switches the open deck; the library keeps the other ones untouched. */
  selectDeck(deckId: string): void {
    if (deckId === this.deck.id) return;

    this.syncActiveDeck();
    const target = this.decks.find((deck) => deck.id === deckId);
    if (!target) return;

    this.deck = target;
    this.selectedSlideId = target.slides[0]?.id ?? "";
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
    this.selectSlide(slide.id);
    this.markChanged();
  }

  duplicateSlide(slideId: string): void {
    const sourceIndex = findSlideIndexById(this.deck, slideId);
    if (sourceIndex === -1) return;

    this.deck = duplicateSlideById(this.deck, slideId);
    const duplicatedSlide = this.deck.slides[sourceIndex + 1];
    if (duplicatedSlide) this.selectSlide(duplicatedSlide.id);
    this.markChanged();
  }

  deleteSlide(slideId: string): void {
    if (!this.canDeleteSelectedSlide) return;

    const removedIndex = findSlideIndexById(this.deck, slideId);
    this.deck = removeSlideById(this.deck, slideId);
    const nextSlide = this.deck.slides[Math.min(removedIndex, this.deck.slides.length - 1)];
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
    if (!this.selectedSlide) return;
    this.deck = updateSlideContentAtPath(this.deck, this.selectedSlide.id, path, value);
    this.markChanged();
  }

  /** Moves one diagram box; the preview calls this when a drag ends. */
  moveDiagramBox(boxIndex: number, position: { x: number; y: number }): void {
    const slide = this.selectedSlide;
    if (!slide || slide.layout !== "diagram") return;

    const movedHorizontally = updateSlideContentAtPath(this.deck, slide.id, ["boxes", boxIndex, "x"], position.x);
    this.deck = updateSlideContentAtPath(movedHorizontally, slide.id, ["boxes", boxIndex, "y"], position.y);
    this.markChanged();
  }

  appendSlideListItem(listFieldPath: ContentPath): void {
    if (!this.selectedSlide) return;
    const emptyItem = createEmptyListItem(this.selectedSlide.layout, listFieldPath);
    this.deck = appendSlideContentItem(this.deck, this.selectedSlide.id, listFieldPath, emptyItem);
    this.markChanged();
  }

  removeSlideListItem(listFieldPath: ContentPath, index: number): void {
    if (!this.selectedSlide) return;
    this.deck = removeSlideContentItem(this.deck, this.selectedSlide.id, listFieldPath, index);
    this.markChanged();
  }

  moveSlideListItem(listFieldPath: ContentPath, fromIndex: number, toIndex: number): void {
    if (!this.selectedSlide) return;
    this.deck = moveSlideContentItem(this.deck, this.selectedSlide.id, listFieldPath, fromIndex, toIndex);
    this.markChanged();
  }

  /** Adds a fresh deck to the library and opens it; the others are kept. */
  startNewDeck(): void {
    const deck = createNewDeck(`Untitled deck ${this.decks.length + 1}`);
    this.decks = [...this.decks, deck];
    this.deck = deck;
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

  /** Mirrors the open deck into the library so the list and the save see it. */
  private syncActiveDeck(): void {
    const snapshot = $state.snapshot(this.deck) as Deck;
    const index = this.decks.findIndex((deck) => deck.id === snapshot.id);

    if (index === -1) this.decks = [...this.decks, snapshot];
    else this.decks[index] = snapshot;
  }
}
