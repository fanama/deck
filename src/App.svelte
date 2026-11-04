<script lang="ts">
  import { buildDeckThemeVariables, toStyleAttributeValue } from "./domain/deck/deckTheme.ts";
  import DeckDetailsPanel from "./presentation/components/DeckDetailsPanel.svelte";
  import InspectorPanel from "./presentation/components/InspectorPanel.svelte";
  import NoticeBar from "./presentation/components/NoticeBar.svelte";
  import PresentationOverlay from "./presentation/components/PresentationOverlay.svelte";
  import PreviewStage from "./presentation/components/PreviewStage.svelte";
  import SlideListPanel from "./presentation/components/SlideListPanel.svelte";
  import StudioHeader from "./presentation/components/StudioHeader.svelte";
  import WelcomeScreen from "./presentation/components/WelcomeScreen.svelte";
  import { PresentationStudio } from "./presentation/state/PresentationStudio.svelte.ts";

  const studio = new PresentationStudio();

  let isWelcomeOpen = $state(true);

  let themeStyle = $derived(toStyleAttributeValue(buildDeckThemeVariables(studio.deck.theme)));

  // Autosave: debounce every deck change into one browser write.
  $effect(() => {
    const deckSnapshot: unknown = $state.snapshot(studio.deck);
    if (studio.isSaved) return;

    const saveTimer = setTimeout(() => studio.saveDeckSnapshot(deckSnapshot as typeof studio.deck), 600);
    return () => clearTimeout(saveTimer);
  });

  function isTypingTarget(target: EventTarget | null): boolean {
    return (
      target instanceof HTMLElement &&
      (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
    );
  }

  /** Keys that only mean something while the deck is on screen. */
  function handlePresentationKey(event: KeyboardEvent): boolean {
    switch (event.key) {
      case "Escape":
        studio.stopPresenting();
        return true;
      case "ArrowRight":
      case "PageDown":
      case " ":
      case "Enter":
        studio.openNextSlide();
        return true;
      case "ArrowLeft":
      case "PageUp":
      case "Backspace":
        studio.openPreviousSlide();
        return true;
      case "Home":
        studio.openFirstSlide();
        return true;
      case "End":
        studio.openLastSlide();
        return true;
      default:
        return false;
    }
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (isTypingTarget(event.target)) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    if (isWelcomeOpen) {
      if (event.key === "Enter") {
        event.preventDefault();
        isWelcomeOpen = false;
      }
      return;
    }

    if (studio.isPresenting) {
      if (handlePresentationKey(event)) event.preventDefault();
      return;
    }

    if (event.key === "p" || event.key === "P") {
      event.preventDefault();
      studio.startPresenting();
      return;
    }

    if (event.key === "ArrowRight" || event.key === "PageDown") {
      event.preventDefault();
      studio.openNextSlide();
    } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
      event.preventDefault();
      studio.openPreviousSlide();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isWelcomeOpen}
  <WelcomeScreen deck={studio.deck} onEnter={() => (isWelcomeOpen = false)} />
{:else}
  <div class="studio" style={themeStyle}>
    <StudioHeader {studio} onOpenWelcome={() => (isWelcomeOpen = true)} />

    {#if studio.notice}
      <NoticeBar notice={studio.notice} onDismiss={() => studio.dismissNotice()} />
    {/if}

    <main class="studio-main">
      <aside class="studio-column studio-column-left">
        <DeckDetailsPanel {studio} />
        <SlideListPanel {studio} />
      </aside>

      <section class="studio-column studio-column-center">
        <PreviewStage
          deck={studio.deck}
          slide={studio.selectedSlide}
          slideNumber={studio.selectedSlideIndex + 1}
          totalSlides={studio.deck.slides.length}
        />

        <div class="preview-controls">
          <div class="preview-nav">
            <button
              class="button small"
              type="button"
              aria-label="Previous slide"
              onclick={() => studio.openPreviousSlide()}
            >
              ←
            </button>
            <span class="preview-counter">{studio.selectedSlideIndex + 1} / {studio.deck.slides.length}</span>
            <button class="button small" type="button" aria-label="Next slide" onclick={() => studio.openNextSlide()}>
              →
            </button>
          </div>
          <span class="preview-layout">{studio.selectedSlideLayout.label}</span>
        </div>
      </section>

      <aside class="studio-column studio-column-right">
        <InspectorPanel {studio} />
      </aside>
    </main>

    {#if studio.isPresenting}
      <PresentationOverlay {studio} />
    {/if}
  </div>
{/if}
