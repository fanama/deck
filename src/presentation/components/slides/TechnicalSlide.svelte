<script lang="ts">
  import type { TechnicalSlideContent } from "../../../domain/deck/slideTypes.ts";
  import EditableText from "../EditableText.svelte";

  let { content }: { content: TechnicalSlideContent } = $props();
</script>

<EditableText as="div" class="eyebrow" path={["eyebrow"]} value={content.eyebrow} />

<div class="body">
  <EditableText as="h2" path={["heading"]} value={content.heading} />

  <div class="cols" style="--columns: 2; gap: 36px; align-items: start;">
    <ul class="clean">
      {#each content.points as point, index (index)}
        <EditableText as="li" path={["points", index]} value={point} />
      {/each}
    </ul>

    <div class="card" style="padding: 22px;">
      <EditableText as="h3" path={["componentsTitle"]} value={content.componentsTitle} />
      <div class="mono-list">
        {#each content.components as component, index (index)}
          <EditableText as="span" class="mono" path={["components", index]} value={component} />
        {/each}
      </div>

      {#if content.note}
        <EditableText as="p" class="note" path={["note"]} value={content.note} />
      {/if}
    </div>
  </div>
</div>
