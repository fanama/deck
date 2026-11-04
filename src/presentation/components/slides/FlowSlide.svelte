<script lang="ts">
  import type { FlowSlideContent } from "../../../domain/deck/slideTypes.ts";

  let { content }: { content: FlowSlideContent } = $props();
</script>

<div class="eyebrow">{content.eyebrow}</div>

<div class="body">
  <h2>{content.heading}</h2>

  <div class="lanes">
    {#each content.lanes as lane, laneIndex (laneIndex)}
      <div class="lane">
        <div class="lane-label">{lane.label}</div>
        <div class="row">
          {#each lane.nodes as node, nodeIndex (nodeIndex)}
            {#if nodeIndex > 0}
              <div class="arrow">→</div>
            {/if}
            <div class="node">
              <strong>{node.title}</strong>
              <span>{node.detail}</span>
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>

  {#if content.note}
    <p class="note">{content.note}</p>
  {/if}
</div>
