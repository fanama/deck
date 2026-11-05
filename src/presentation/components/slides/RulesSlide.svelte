<script lang="ts">
  import type { RulesSlideContent } from "../../../domain/deck/slideTypes.ts";
  import EditableText from "../EditableText.svelte";

  let { content }: { content: RulesSlideContent } = $props();
</script>

<EditableText as="div" class="eyebrow" path={["eyebrow"]} value={content.eyebrow} />

<div class="body">
  <EditableText as="h2" path={["heading"]} value={content.heading} />

  <div class="rules">
    {#each content.rules as rule, index (index)}
      <div class="rule">
        <EditableText as="div" class="k" path={["rules", index, "marker"]} value={rule.marker} />
        <EditableText as="p" path={["rules", index, "statement"]} value={rule.statement} />
      </div>
    {/each}
  </div>

  {#if content.note}
    <EditableText as="p" class="note" path={["note"]} value={content.note} />
  {/if}
</div>
