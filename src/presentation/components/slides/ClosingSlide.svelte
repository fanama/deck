<script lang="ts">
  import type { ClosingSlideContent } from "../../../domain/deck/slideTypes.ts";
  import EditableText from "../EditableText.svelte";

  let { content }: { content: ClosingSlideContent } = $props();
</script>

<EditableText as="div" class="eyebrow" path={["eyebrow"]} value={content.eyebrow} />

<div class="title-grid" style="flex: 1; align-items: center;">
  <div>
    <EditableText as="h1" path={["heading"]} value={content.heading} />
    <EditableText as="p" class="lede" path={["lede"]} value={content.lede} />
  </div>

  {#if content.meta.length > 0}
    <dl class="kv">
      {#each content.meta as row, index (index)}
        <div>
          <EditableText as="dt" path={["meta", index, "label"]} value={row.label} />
          <EditableText as="dd" path={["meta", index, "value"]} value={row.value} />
        </div>
      {/each}
    </dl>
  {/if}
</div>
