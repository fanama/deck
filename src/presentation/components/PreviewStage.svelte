<script lang="ts">
  import type { Deck, Slide } from "../../domain/deck/slideTypes.ts";
  import SlideSurface from "./SlideSurface.svelte";

  let {
    deck,
    slide,
    slideNumber,
    totalSlides,
  }: {
    deck: Deck;
    slide: Slide | null;
    slideNumber: number;
    totalSlides: number;
  } = $props();

  let frameWidth = $state(0);
  let frameHeight = $state(0);
  let scale = $derived(Math.min(frameWidth / 1280, frameHeight / 720) * 0.98 || 0.1);
</script>

<div class="preview-frame" bind:clientWidth={frameWidth} bind:clientHeight={frameHeight}>
  {#if slide}
    <div class="preview-stage" style="transform: translate(-50%, -50%) scale({scale});">
      <SlideSurface {deck} {slide} {slideNumber} {totalSlides} />
    </div>
  {/if}
</div>
