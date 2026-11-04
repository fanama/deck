<script lang="ts">
  import type { TechnicalSlideContent } from "../../../domain/deck/slideTypes.ts";

  let { content }: { content: TechnicalSlideContent } = $props();
</script>

<div class="eyebrow">{content.eyebrow}</div>

<div class="body">
  <h2>{content.heading}</h2>

  <div class="cols" style="--columns: 2; gap: 36px; align-items: start;">
    <ul class="clean">
      {#each content.points as point, index (index)}
        <li>{point}</li>
      {/each}
    </ul>

    <div class="card" style="padding: 22px;">
      <h3>{content.componentsTitle}</h3>
      <div class="mono-list">
        {#each content.components as component, index (index)}
          <span class="mono">{component}</span>
        {/each}
      </div>

      {#if content.note}
        <p class="note" style="margin-top: 14px;">{content.note}</p>
      {/if}
    </div>
  </div>
</div>
