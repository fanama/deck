<script lang="ts">
  import type { TitleSlideContent } from "../../../domain/deck/slideTypes.ts";

  let { content }: { content: TitleSlideContent } = $props();
</script>

<div class="eyebrow">{content.eyebrow}</div>

<div class="title-grid" style="flex: 1; align-items: center;">
  <div>
    <h1>{content.heading}</h1>
    <p class="lede">{content.lede}</p>

    {#if content.pills.length > 0}
      <div class="pills" style="margin-top: 26px;">
        {#each content.pills as pill, index (index)}
          <span class="pill">{pill}</span>
        {/each}
      </div>
    {/if}
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
