<script lang="ts">
  import type { StatementSlideContent } from "../../../domain/deck/slideTypes.ts";

  let { content }: { content: StatementSlideContent } = $props();
</script>

<div class="eyebrow">{content.eyebrow}</div>

<div class="body">
  <h2>{content.heading}</h2>

  <div class="cols" style="--columns: 2; gap: 48px; align-items: center;">
    <ul class="clean">
      {#each content.points as point, index (index)}
        <li>{point}</li>
      {/each}
    </ul>

    <div class="card" style="padding: 24px;">
      <div class="stat">
        {content.figure}
        <small>{content.figureCaption}</small>
      </div>
    </div>
  </div>
</div>
