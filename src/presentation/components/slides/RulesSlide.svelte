<script lang="ts">
  import type { RulesSlideContent } from "../../../domain/deck/slideTypes.ts";

  let { content }: { content: RulesSlideContent } = $props();
</script>

<div class="eyebrow">{content.eyebrow}</div>

<div class="body">
  <h2>{content.heading}</h2>

  <div class="rules">
    {#each content.rules as rule, index (index)}
      <div class="rule">
        <div class="k">{rule.marker}</div>
        <p>{rule.statement}</p>
      </div>
    {/each}
  </div>

  {#if content.note}
    <p class="note">{content.note}</p>
  {/if}
</div>
