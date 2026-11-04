<script lang="ts">
  import { findSlideLayout, SLIDE_LAYOUTS } from "../../domain/deck/slideLayoutCatalog.ts";
  import type { SlideLayoutId } from "../../domain/deck/slideTypes.ts";
  import type { PresentationStudio } from "../state/PresentationStudio.svelte.ts";

  let { studio }: { studio: PresentationStudio } = $props();
  let isAddMenuOpen = $state(false);

  function addSlideWithLayout(layoutId: SlideLayoutId): void {
    studio.addSlideWithLayout(layoutId);
    isAddMenuOpen = false;
  }
</script>

<div class="panel panel-slides">
  <div class="panel-head">
    <h2 class="panel-title">Slides</h2>
    <span class="panel-meta">{studio.selectedSlideIndex + 1} / {studio.deck.slides.length}</span>
  </div>

  <ol class="slide-list">
    {#each studio.deck.slides as slide, index (slide.id)}
      <li class="slide-row" class:is-selected={slide.id === studio.selectedSlideId}>
        <button class="slide-select" type="button" onclick={() => studio.selectSlide(slide.id)}>
          <span class="slide-number">{String(index + 1).padStart(2, "0")}</span>
          <span class="slide-text">
            <span class="slide-heading">{slide.content.heading || "Untitled slide"}</span>
            <span class="slide-layout">{findSlideLayout(slide.layout).label}</span>
          </span>
        </button>
      </li>
    {/each}
  </ol>

  <div class="slide-actions">
    <button
      class="button small"
      type="button"
      disabled={studio.selectedSlideIndex === 0}
      onclick={() => studio.moveSlideUp(studio.selectedSlideId)}
    >Move up</button>
    <button
      class="button small"
      type="button"
      disabled={studio.selectedSlideIndex === studio.deck.slides.length - 1}
      onclick={() => studio.moveSlideDown(studio.selectedSlideId)}
    >Move down</button>
    <button class="button small" type="button" onclick={() => studio.duplicateSlide(studio.selectedSlideId)}>
      Duplicate
    </button>
    <button
      class="button small"
      type="button"
      disabled={!studio.canDeleteSelectedSlide}
      onclick={() => studio.deleteSlide(studio.selectedSlideId)}
    >Delete</button>
  </div>

  <div class="add-slide">
    <button class="button" type="button" onclick={() => (isAddMenuOpen = !isAddMenuOpen)}>
      {isAddMenuOpen ? "Close layout list" : "+ Add slide"}
    </button>

    {#if isAddMenuOpen}
      <ul class="layout-menu">
        {#each SLIDE_LAYOUTS as layout (layout.id)}
          <li>
            <button class="layout-option" type="button" onclick={() => addSlideWithLayout(layout.id)}>
              <span class="layout-option-label">{layout.label}</span>
              <span class="layout-option-purpose">{layout.purpose}</span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>
