<script lang="ts">
  import type { StatementSlideContent } from "../../../domain/deck/slideTypes.ts";
  import EditableText from "../EditableText.svelte";

  let { content }: { content: StatementSlideContent } = $props();
</script>

<EditableText as="div" class="eyebrow" path={["eyebrow"]} value={content.eyebrow} />

<div class="body">
  <EditableText as="h2" path={["heading"]} value={content.heading} />

  <div class="cols" style="--columns: 2; gap: 48px; align-items: center;">
    <ul class="clean">
      {#each content.points as point, index (index)}
        <EditableText as="li" path={["points", index]} value={point} />
      {/each}
    </ul>

    <div class="card" style="padding: 24px;">
      <div class="stat">
        <EditableText as="span" path={["figure"]} value={content.figure} />
        <EditableText as="small" path={["figureCaption"]} value={content.figureCaption} />
      </div>
    </div>
  </div>
</div>
