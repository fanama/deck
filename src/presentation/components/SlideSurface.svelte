<script lang="ts">
  import { slideShellClassForLayout } from "../../domain/deck/slideLayoutCatalog.ts";
  import type { Deck, Slide } from "../../domain/deck/slideTypes.ts";
  import CardsSlide from "./slides/CardsSlide.svelte";
  import ClosingSlide from "./slides/ClosingSlide.svelte";
  import FlowSlide from "./slides/FlowSlide.svelte";
  import RulesSlide from "./slides/RulesSlide.svelte";
  import StatementSlide from "./slides/StatementSlide.svelte";
  import TechnicalSlide from "./slides/TechnicalSlide.svelte";
  import TitleSlide from "./slides/TitleSlide.svelte";

  let {
    slide,
    deck,
    slideNumber,
    totalSlides,
  }: {
    slide: Slide | null;
    deck: Deck;
    slideNumber: number;
    totalSlides: number;
  } = $props();
</script>

{#if slide}
  <section class="{slideShellClassForLayout(slide.layout)} active">
    {#if slide.layout === "title"}
      <TitleSlide content={slide.content} />
    {:else if slide.layout === "cards"}
      <CardsSlide content={slide.content} />
    {:else if slide.layout === "flow"}
      <FlowSlide content={slide.content} />
    {:else if slide.layout === "rules"}
      <RulesSlide content={slide.content} />
    {:else if slide.layout === "statement"}
      <StatementSlide content={slide.content} />
    {:else if slide.layout === "technical"}
      <TechnicalSlide content={slide.content} />
    {:else if slide.layout === "closing"}
      <ClosingSlide content={slide.content} />
    {/if}

    <div class="footer">
      <span>{deck.footerLabel}</span>
      <span>{slideNumber} / {totalSlides}</span>
    </div>
  </section>
{/if}
