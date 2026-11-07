<script lang="ts">
  import type { SlideImage } from "../../domain/deck/slideTypes.ts";
  import { readSlideImageFile } from "../../infrastructure/browser/readSlideImageFile.ts";

  let {
    label,
    image,
    onChange,
    onError,
  }: {
    label: string;
    image: SlideImage | null | undefined;
    onChange: (image: SlideImage | null) => void;
    onError?: (message: string) => void;
  } = $props();

  let fileInput = $state<HTMLInputElement | undefined>(undefined);
  let isReading = $state(false);

  async function handleFileChosen(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    isReading = true;

    try {
      onChange(await readSlideImageFile(file));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onError?.(`That image could not be used: ${message}`);
    } finally {
      isReading = false;
    }
  }
</script>

<div class="image-field">
  <div class="image-field-head">
    <span class="field-label">{label}</span>
    {#if image}
      <span class="field-hint">{image.width} × {image.height}</span>
    {/if}
  </div>

  {#if image}
    <img
      class="image-field-preview"
      src={image.src}
      alt={image.alt || `${label} preview`}
    />
    <div class="image-field-actions">
      <button
        class="button small"
        type="button"
        disabled={isReading}
        onclick={() => fileInput?.click()}
      >
        Replace
      </button>
      <button class="button small" type="button" disabled={isReading} onclick={() => onChange(null)}>
        Remove
      </button>
    </div>
  {:else}
    <button
      class="button small image-field-choose"
      type="button"
      disabled={isReading}
      onclick={() => fileInput?.click()}
    >
      {isReading ? "Reading image…" : "Choose image"}
    </button>
  {/if}

  <input
    bind:this={fileInput}
    hidden
    type="file"
    accept="image/png,image/jpeg,image/gif,image/webp,image/avif,image/svg+xml"
    onchange={handleFileChosen}
  />
</div>
