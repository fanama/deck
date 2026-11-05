<script lang="ts">
  import { buildDeckThemeVariables, toStyleAttributeValue } from "../../domain/deck/deckTheme.ts";
  import type { Deck } from "../../domain/deck/slideTypes.ts";
  import SlideSurface from "./SlideSurface.svelte";

  let { deck, onEnter }: { deck: Deck; onEnter: () => void } = $props();

  const GITHUB_URL = "https://github.com/fanama";

  let artifactWidth = $state(0);

  const themeStyle = $derived(toStyleAttributeValue(buildDeckThemeVariables(deck.theme)));
  const firstSlide = $derived(deck.slides[0] ?? null);
  const artifactScale = $derived(artifactWidth > 0 ? artifactWidth / 1280 : 0.4);
</script>

<div class="welcome" style={themeStyle}>
  <header class="welcome-header">
    <div class="brand">
      <span class="brand-mark"></span>
      <span class="brand-name">Deck Studio</span>
      <span class="brand-sub">HTML presentations</span>
    </div>

    <a class="welcome-github" href={GITHUB_URL} target="_blank" rel="noreferrer noopener">
      github.com/fanama
      <span class="welcome-github-mark" aria-hidden="true">&#8599;</span>
    </a>
  </header>

  <main class="welcome-main">
    <div class="welcome-copy">
      <h1>Write the deck in the browser, present it from a file.</h1>

      <p class="welcome-lede">
        Nine structured layouts and one stylesheet. The deck saves in this browser and exports as a
        single self-contained HTML file — open it from disk, arrow through it, print one slide per page.
        PowerPoint export writes the same deck with editable text and shapes.
      </p>

      <div class="welcome-actions">
        <button class="button primary" type="button" onclick={onEnter}>Open the studio</button>
      </div>

      <dl class="welcome-facts">
        <div>
          <dt>Exports</dt>
          <dd>One self-contained HTML file, or a native PowerPoint deck</dd>
        </div>
        <div>
          <dt>Storage</dt>
          <dd>This browser, saved automatically</dd>
        </div>
        <div>
          <dt>Runtime</dt>
          <dd>No server, no network, no fonts to download</dd>
        </div>
      </dl>
    </div>

    <figure class="welcome-artifact">
      <div class="welcome-artifact-frame" bind:clientWidth={artifactWidth}>
        <div class="welcome-artifact-stage" style="transform: scale({artifactScale});">
          {#if firstSlide}
            <SlideSurface {deck} slide={firstSlide} slideNumber={1} totalSlides={deck.slides.length} />
          {/if}
        </div>
      </div>
      <figcaption>
        Slide 1 of your deck, rendered by the same stylesheet the export writes.
      </figcaption>
    </figure>
  </main>

  <footer class="welcome-footer">
    <span>Deck Studio — Svelte 5, TypeScript, no runtime dependencies.</span>
    <span>Decks stay in this browser until you export them.</span>
  </footer>
</div>
