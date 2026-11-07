<script lang="ts">
  import type { PresentationStudio } from "../state/PresentationStudio.svelte.ts";

  const ACCENT_PRESETS: string[] = ["#0f6b64", "#1d4ed8", "#b45309", "#7c3aed", "#9f1239", "#334155"];
  const BACKGROUND_PRESETS: string[] = ["#ffffff", "#f6f4ef", "#eef2f6", "#101820"];
  const TEXT_PRESETS: string[] = ["#12171f", "#33404f", "#f6f4ef", "#ffffff"];

  let { studio }: { studio: PresentationStudio } = $props();
</script>

<div class="panel panel-deck">
  <div class="panel-head">
    <h2 class="panel-title">Deck</h2>
  </div>

  <label class="field">
    <span class="field-label">Title</span>
    <input
      class="field-input"
      type="text"
      value={studio.deck.title}
      oninput={(event) => studio.changeDeckTitle(event.currentTarget.value)}
    />
  </label>

  <label class="field">
    <span class="field-label">Footer label</span>
    <input
      class="field-input"
      type="text"
      value={studio.deck.footerLabel}
      oninput={(event) => studio.changeFooterLabel(event.currentTarget.value)}
    />
  </label>

  <div class="field">
    <span class="field-label">Accent</span>
    <div class="theme-swatches">
      {#each ACCENT_PRESETS as color (color)}
        <button
          type="button"
          class="swatch"
          class:is-selected={studio.deck.theme.accentColor === color}
          style="background: {color}"
          aria-label="Accent {color}"
          onclick={() => studio.changeAccentColor(color)}
        ></button>
      {/each}
      <input
        class="swatch-input"
        type="color"
        value={studio.deck.theme.accentColor}
        aria-label="Custom accent colour"
        oninput={(event) => studio.changeAccentColor(event.currentTarget.value)}
      />
    </div>
  </div>

  <div class="field">
    <span class="field-label">Background</span>
    <div class="theme-swatches">
      {#each BACKGROUND_PRESETS as color (color)}
        <button
          type="button"
          class="swatch"
          class:is-selected={studio.deck.theme.backgroundColor === color}
          style="background: {color}"
          aria-label="Background {color}"
          onclick={() => studio.changeBackgroundColor(color)}
        ></button>
      {/each}
      <input
        class="swatch-input"
        type="color"
        value={studio.deck.theme.backgroundColor}
        aria-label="Custom background colour"
        oninput={(event) => studio.changeBackgroundColor(event.currentTarget.value)}
      />
    </div>
  </div>

  <div class="field">
    <span class="field-label">Text</span>
    <div class="theme-swatches">
      {#each TEXT_PRESETS as color (color)}
        <button
          type="button"
          class="swatch"
          class:is-selected={studio.deck.theme.textColor === color}
          style="background: {color}"
          aria-label="Text {color}"
          onclick={() => studio.changeTextColor(color)}
        ></button>
      {/each}
      <input
        class="swatch-input"
        type="color"
        value={studio.deck.theme.textColor}
        aria-label="Custom text colour"
        oninput={(event) => studio.changeTextColor(event.currentTarget.value)}
      />
    </div>
  </div>

  <button class="button small theme-reset" type="button" onclick={() => studio.resetDeckColors()}>
    Reset colours
  </button>
</div>
