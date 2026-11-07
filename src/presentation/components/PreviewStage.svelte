<script lang="ts">
  import type { ContentPath, Deck, Slide } from "../../domain/deck/slideTypes.ts";
  import SlideSurface from "./SlideSurface.svelte";

  let {
    deck,
    slide,
    slideNumber,
    totalSlides,
    onDiagramBoxesMove,
    onSlideTextChange,
    selectedDiagramBoxId,
    selectedDiagramBoxIds,
    onSelectDiagramBox,
    onDiagramBoxResize,
  }: {
    deck: Deck;
    slide: Slide | null;
    slideNumber: number;
    totalSlides: number;
    onDiagramBoxesMove?: (
      updates: ReadonlyArray<{ index: number; x: number; y: number }>,
      nest?: { boxId: string; parentId: string | null },
    ) => void;
    onSlideTextChange?: (path: ContentPath, value: unknown) => void;
    selectedDiagramBoxId?: string | null;
    selectedDiagramBoxIds?: string[];
    onSelectDiagramBox?: (boxId: string | null, additive?: boolean) => void;
    onDiagramBoxResize?: (
      index: number,
      rect: { x: number; y: number; width: number; height: number },
    ) => void;
  } = $props();

  let frameWidth = $state(0);
  let frameHeight = $state(0);
  let scale = $derived(Math.min(frameWidth / 1280, frameHeight / 720) * 0.98 || 0.1);
</script>

<div class="preview-frame" bind:clientWidth={frameWidth} bind:clientHeight={frameHeight}>
  {#if slide}
    <div class="preview-stage" style="transform: translate(-50%, -50%) scale({scale});">
      <SlideSurface
        {deck}
        {slide}
        {slideNumber}
        {totalSlides}
        {onDiagramBoxesMove}
        {onSlideTextChange}
        {selectedDiagramBoxId}
        {selectedDiagramBoxIds}
        {onSelectDiagramBox}
        {onDiagramBoxResize}
      />
    </div>
  {/if}
</div>
