<script lang="ts">
  import type { ClosingSlideContent } from "../../../domain/deck/slideTypes.ts";

  let { content }: { content: ClosingSlideContent } = $props();
</script>

<div class="eyebrow">{content.eyebrow}</div>

<div class="title-grid" style="flex: 1; align-items: center;">
  <div>
    <h1>{content.heading}</h1>
    <p class="lede">{content.lede}</p>
  </div>

  {#if content.meta.length > 0}
    <dl class="kv">
      {#each content.meta as row, index (index)}
        <div>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      {/each}
    </dl>
  {/if}
</div>
