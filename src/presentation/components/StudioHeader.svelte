<script lang="ts">
  import type { PresentationStudio } from "../state/PresentationStudio.svelte.ts";

  let {
    studio,
    onOpenWelcome,
  }: {
    studio: PresentationStudio;
    /** Returns to the welcome page; the deck stays in memory and in storage. */
    onOpenWelcome: () => void;
  } = $props();

  let fileInput = $state<HTMLInputElement | undefined>(undefined);

  async function handleFileChosen(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];

    // Clearing the value lets the same file be chosen again after a failure.
    input.value = "";
    if (!file) return;

    try {
      studio.importDeckFromText(await file.text());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      studio.showNotice("error", `That file could not be read: ${message}`);
    }
  }
</script>

<header class="studio-header">
  <button
    class="brand brand-button"
    type="button"
    title="Back to the welcome page"
    onclick={onOpenWelcome}
  >
    <span class="brand-mark"></span>
    <span class="brand-name">Deck Studio</span>
    <span class="brand-sub">HTML presentations</span>
  </button>

  <div class="header-actions">
    <span class="save-indicator" class:is-dirty={!studio.isSaved}>
      {studio.isSaved ? "Saved in this browser" : "Unsaved changes"}
    </span>
    <button class="button" type="button" onclick={() => fileInput?.click()}>Import deck</button>
    <button class="button" type="button" onclick={() => studio.startNewDeck()}>New deck</button>
    <button class="button" type="button" onclick={() => studio.saveNow()}>Save now</button>
    <button class="button" type="button" title="Present (P)" onclick={() => studio.startPresenting()}>
      Present
    </button>
    <button class="button" type="button" onclick={() => studio.exportCurrentDeckAsPptx()}>
      Export PPTX
    </button>
    <button class="button primary" type="button" onclick={() => studio.exportCurrentDeck()}>
      Export HTML
    </button>
    <input
      bind:this={fileInput}
      hidden
      type="file"
      accept=".html,.htm,.json,text/html,application/json"
      onchange={handleFileChosen}
    />
  </div>
</header>
