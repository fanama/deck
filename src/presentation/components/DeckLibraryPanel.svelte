<script lang="ts">
  import type { PresentationStudio } from "../state/PresentationStudio.svelte.ts";

  let { studio }: { studio: PresentationStudio } = $props();
</script>

<div class="panel panel-library">
  <div class="panel-head">
    <h2 class="panel-title">Decks</h2>
    <span class="panel-meta">{studio.decks.length}</span>
  </div>

  <ul class="deck-list">
    {#each studio.decks as deck (deck.id)}
      <li class="deck-row" class:is-selected={deck.id === studio.deck.id}>
        <button
          class="deck-select"
          type="button"
          aria-current={deck.id === studio.deck.id ? "true" : undefined}
          onclick={() => studio.selectDeck(deck.id)}
        >
          <span class="deck-title">{deck.title || "Untitled deck"}</span>
          <span class="deck-meta">{deck.slides.length} slide{deck.slides.length === 1 ? "" : "s"}</span>
        </button>
        <button
          class="icon-button"
          type="button"
          title="Delete this deck"
          aria-label="Delete {deck.title || 'Untitled deck'}"
          disabled={studio.decks.length <= 1}
          onclick={() => studio.deleteDeck(deck.id)}
        >×</button>
      </li>
    {/each}
  </ul>

  <div class="deck-add">
    <button class="button small" type="button" onclick={() => studio.startNewDeck()}>+ New deck</button>
  </div>
</div>
