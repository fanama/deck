import { createNewDeck, createStarterDeck } from "../../application/createStarterDeck.ts";
import { exportDeckAsHtmlFile } from "../../application/exportDeckAsHtmlFile.ts";
import { exportDeckAsPptxFile } from "../../application/exportDeckAsPptxFile.ts";
import { loadSavedDeck } from "../../application/loadSavedDeck.ts";
import { parseDeckFileText } from "../../application/parseDeckFileText.ts";
import { saveDeck } from "../../application/saveDeck.ts";
import {
  appendSlideContentItem,
  createBlankSlide,
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
import type { DeckRepository } from "../../domain/ports/deckRepositoryPort.ts";
import { downloadBinaryFile } from "../../infrastructure/browser/downloadBinaryFile.ts";
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
const pptxExporter = createPptxDeckExporter();

const savedDeck = loadSavedDeck(deckRepository);
const initialDeck = savedDeck ?? createStarterDeck();

/**
 * The studio's presentation state. It owns the current deck, the selection,
 * autosave and the notice bar; every slide change is delegated to the domain
 * so this class never edits deck data itself.
 */
export class PresentationStudio {
  deck = $state<Deck>(initialDeck);
  selectedSlideId = $state<string>(initialDeck.slides[0]?.id ?? "");
  isSaved = $state<boolean>(savedDeck !== null);
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

  startNewDeck(): void {
    this.deck = createNewDeck();
    this.selectSlide(this.deck.slides[0].id);
    this.markChanged();
    this.showNotice("success", "Started a new deck. The saved deck is replaced on the next save.");
  }

  importDeckFromText(fileText: string): void {
    const parsed = parseDeckFileText(fileText);

    if (!parsed.ok) {
      this.showNotice("error", parsed.message);
      return;
    }

    const slideCount = parsed.deck.slides.length;
    this.deck = parsed.deck;
    this.selectSlide(parsed.deck.slides[0]?.id ?? "");
    this.markChanged();
    this.showNotice(
      "success",
      `Imported ${parsed.deck.title} — ${slideCount} slide${slideCount === 1 ? "" : "s"}.`,
    );
  }

  saveDeckSnapshot(deckSnapshot: Deck): void {
    const result = saveDeck(deckRepository, deckSnapshot);

    if (result.ok) {
      this.isSaved = true;
      return;
    }

    this.showNotice("error", result.message);
  }

  saveNow(): void {
    const result = saveDeck(deckRepository, $state.snapshot(this.deck));

    if (!result.ok) {
      this.showNotice("error", result.message);
      return;
    }

    this.isSaved = true;
    this.showNotice("success", "Deck saved in this browser.");
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

  exportCurrentDeckAsPptx(): void {
    const result = exportDeckAsPptxFile({
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
  }

  showNotice(kind: StudioNotice["kind"], message: string): void {
    this.notice = { kind, message };
  }

  dismissNotice(): void {
    this.notice = null;
  }

  markChanged(): void {
    this.isSaved = false;
  }
}
