<script lang="ts">
  import type { CardsSlideContent } from "../../../domain/deck/slideTypes.ts";

  let { content }: { content: CardsSlideContent } = $props();
  let columnCount = $derived(Math.min(4, Math.max(1, content.cards.length)));
</script>

<div class="eyebrow">{content.eyebrow}</div>

<div class="body">
  <h2>{content.heading}</h2>

  <div class="cols" style="--columns: {columnCount}">
    {#each content.cards as card, index (index)}
      <div class="card">
        <span class="num">{card.marker}</span>
        <h3>{card.title}</h3>
        <p>{card.body}</p>
      </div>
    {/each}
  </div>

  {#if content.note}
    <p class="note">{content.note}</p>
  {/if}
</div>
