<script lang="ts">
  import type { FlowSlideContent } from "../../../domain/deck/slideTypes.ts";
  import EditableText from "../EditableText.svelte";

  let { content }: { content: FlowSlideContent } = $props();
</script>

<EditableText as="div" class="eyebrow" path={["eyebrow"]} value={content.eyebrow} />

<div class="body">
  <EditableText as="h2" path={["heading"]} value={content.heading} />

  <div class="lanes">
    {#each content.lanes as lane, laneIndex (laneIndex)}
      <div class="lane">
        <EditableText
          as="div"
          class="lane-label"
          path={["lanes", laneIndex, "label"]}
          value={lane.label}
        />
        <div class="row">
          {#each lane.nodes as node, nodeIndex (nodeIndex)}
            {#if nodeIndex > 0}
              <div class="arrow">→</div>
            {/if}
            <div class="node">
              <EditableText
                as="strong"
                path={["lanes", laneIndex, "nodes", nodeIndex, "title"]}
                value={node.title}
              />
              <EditableText
                as="span"
                path={["lanes", laneIndex, "nodes", nodeIndex, "detail"]}
                value={node.detail}
              />
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>

  {#if content.note}
    <EditableText as="p" class="note" path={["note"]} value={content.note} />
  {/if}
</div>
