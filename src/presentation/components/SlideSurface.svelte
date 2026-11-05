<script lang="ts">
  import { setContext } from "svelte";
  import { slideShellClassForLayout } from "../../domain/deck/slideLayoutCatalog.ts";
  import type { ContentPath, Deck, Slide } from "../../domain/deck/slideTypes.ts";
  import CardsSlide from "./slides/CardsSlide.svelte";
  import ClosingSlide from "./slides/ClosingSlide.svelte";
  import DiagramSlide from "./slides/DiagramSlide.svelte";
  import FlowSlide from "./slides/FlowSlide.svelte";
  import RulesSlide from "./slides/RulesSlide.svelte";
  import StatementSlide from "./slides/StatementSlide.svelte";
  import TableSlide from "./slides/TableSlide.svelte";
  import TechnicalSlide from "./slides/TechnicalSlide.svelte";
  import TitleSlide from "./slides/TitleSlide.svelte";
  import { SLIDE_TEXT_EDITING } from "./slideTextEditing.ts";
  import type { SlideTextEditing } from "./slideTextEditing.ts";

  let {
    slide,
    deck,
    slideNumber,
    totalSlides,
    onDiagramBoxMove,
    onSlideTextChange,
  }: {
    slide: Slide | null;
    deck: Deck;
    slideNumber: number;
    totalSlides: number;
    /** Passed by the studio only, so presenting and the welcome page stay read-only. */
    onDiagramBoxMove?: (index: number, position: { x: number; y: number }) => void;
    onSlideTextChange?: (path: ContentPath, value: unknown) => void;
  } = $props();

  // The slide components read this through context, so each layout edits its
  // own fields without threading a callback through every component.
  const textEditing: SlideTextEditing = {
    canEdit: () => onSlideTextChange !== undefined,
    commit: (path, value) => onSlideTextChange?.(path, value),
  };

  setContext(SLIDE_TEXT_EDITING, textEditing);
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
    {:else if slide.layout === "table"}
      <TableSlide content={slide.content} />
    {:else if slide.layout === "diagram"}
      <DiagramSlide
        content={slide.content}
        accent={deck.theme.accentColor}
        onMoveBox={onDiagramBoxMove}
      />
    {:else if slide.layout === "closing"}
      <ClosingSlide content={slide.content} />
    {/if}

    <div class="footer">
      <span>{deck.footerLabel}</span>
      <span>{slideNumber} / {totalSlides}</span>
    </div>
  </section>
{/if}
