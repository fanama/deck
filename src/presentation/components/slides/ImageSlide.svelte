<script lang="ts">
  import type { ImageSlideContent } from "../../../domain/deck/slideTypes.ts";
  import EditableText from "../EditableText.svelte";

  let { content }: { content: ImageSlideContent } = $props();
</script>

<EditableText as="div" class="eyebrow" path={["eyebrow"]} value={content.eyebrow} />

<div class="body image-body">
  <EditableText as="h2" path={["heading"]} value={content.heading} />

  <figure class="slide-figure">
    <div class="slide-figure-frame">
      {#if content.image}
        <img src={content.image.src} alt={content.image.alt} />
      {:else}
        <p class="image-empty">Choose an image in the inspector.</p>
      {/if}
    </div>

    {#if content.caption}
      <figcaption>
        <EditableText as="span" path={["caption"]} value={content.caption} />
      </figcaption>
    {/if}
  </figure>
</div>
