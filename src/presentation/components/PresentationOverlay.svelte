<script lang="ts">
  import type { PresentationStudio } from "../state/PresentationStudio.svelte.ts";
  import SlideSurface from "./SlideSurface.svelte";

  let { studio }: { studio: PresentationStudio } = $props();

  let overlayElement = $state<HTMLDivElement | undefined>(undefined);
  let viewportWidth = $state(0);
  let viewportHeight = $state(0);

  const totalSlides = $derived(studio.deck.slides.length);
  const slideNumber = $derived(studio.selectedSlideIndex + 1);
  const progressPercent = $derived((slideNumber / Math.max(1, totalSlides)) * 100);

  // 1280×720 is the authored stage; scale it down to whatever the display is.
  const scale = $derived(Math.min(viewportWidth / 1280, viewportHeight / 720) * 0.94 || 0.3);

  $effect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    overlayElement?.focus();

    // The browser handles Esc itself while full screen: leaving it must also
    // leave the presenter, or the deck would sit invisible behind the studio.
    function handleFullscreenChange(): void {
      if (!document.fullscreenElement) studio.stopPresenting();
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      previouslyFocused?.focus();
    };
  });
</script>

<div
  class="presenter"
  bind:this={overlayElement}
  bind:clientWidth={viewportWidth}
  bind:clientHeight={viewportHeight}
  role="dialog"
  aria-modal="true"
  aria-label="Presentation"
  tabindex="-1"
>
  <div class="presenter-stage" style="transform: scale({scale});">
    <SlideSurface deck={studio.deck} slide={studio.selectedSlide} {slideNumber} {totalSlides} />
  </div>

  <div class="presenter-progress" aria-hidden="true">
    <span class="presenter-progress-bar" style="width: {progressPercent}%;"></span>
  </div>

  <div class="presenter-chrome">
    <span class="presenter-hint">← → · space · home / end · esc to exit</span>

    <div class="presenter-nav">
      <button class="button small" type="button" aria-label="Previous slide" onclick={() => studio.openPreviousSlide()}>
        ←
      </button>
      <span class="presenter-counter">{slideNumber} / {totalSlides}</span>
      <button class="button small" type="button" aria-label="Next slide" onclick={() => studio.openNextSlide()}>
        →
      </button>
      <button class="button small" type="button" onclick={() => studio.stopPresenting()}>Exit</button>
    </div>
  </div>
</div>
