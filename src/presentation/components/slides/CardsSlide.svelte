<script lang="ts">
  import type { CardsSlideContent } from "../../../domain/deck/slideTypes.ts";
  import EditableText from "../EditableText.svelte";

  let { content }: { content: CardsSlideContent } = $props();
  let columnCount = $derived(Math.min(4, Math.max(1, content.cards.length)));
</script>

<EditableText as="div" class="eyebrow" path={["eyebrow"]} value={content.eyebrow} />

<div class="body">
  <EditableText as="h2" path={["heading"]} value={content.heading} />

  <div class="cols" style="--columns: {columnCount}">
    {#each content.cards as card, index (index)}
      <div class="card">
        <EditableText as="span" class="num" path={["cards", index, "marker"]} value={card.marker} />
        <EditableText as="h3" path={["cards", index, "title"]} value={card.title} />
        <EditableText as="p" path={["cards", index, "body"]} value={card.body} />
      </div>
    {/each}
  </div>

  {#if content.note}
    <EditableText as="p" class="note" path={["note"]} value={content.note} />
  {/if}
</div>
