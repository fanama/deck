/**
 * The document shell of an exported deck: page, viewport, stage, navigation
 * chrome and the print rules. It is kept apart from deck.css because the
 * studio preview supplies its own shell while the export needs this one.
 */
export const DECK_DOCUMENT_CSS = `
  html, body {
    margin: 0;
    height: 100%;
    background: var(--paper);
    color: var(--ink);
    font-family: var(--sans);
    -webkit-font-smoothing: antialiased;
  }

  .viewport {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    overflow: hidden;
  }

  .stage {
    position: relative;
    width: 1280px;
    height: 720px;
    transform-origin: center center;
  }

  .progress {
    position: fixed;
    left: 0;
    top: 0;
    z-index: 10;
    width: 0;
    height: 2px;
    background: var(--accent);
    transition: width 0.25s ease;
  }

  .chrome {
    position: fixed;
    right: 18px;
    bottom: 14px;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    color: var(--muted);
  }

  .chrome button {
    width: 30px;
    height: 30px;
    border: 1px solid var(--line);
    border-radius: 4px;
    background: var(--card);
    color: var(--ink-soft);
    font-size: 14px;
    line-height: 1;
    cursor: pointer;
  }

  .chrome button:hover {
    border-color: var(--muted);
    color: var(--ink);
  }

  .counter {
    min-width: 48px;
    text-align: center;
  }

  .hint {
    position: fixed;
    left: 18px;
    bottom: 18px;
    z-index: 10;
    font-size: 11.5px;
    letter-spacing: 0.04em;
    color: var(--muted);
  }

  @page {
    size: 1280px 720px;
    margin: 0;
  }

  @media print {
    html, body {
      height: auto;
      background: var(--paper);
    }

    .viewport {
      position: static;
      display: block;
      overflow: visible;
    }

    .stage {
      width: 1280px;
      height: auto;
      transform: none !important;
    }

    .slide {
      display: flex !important;
      position: relative;
      width: 1280px;
      height: 720px;
      page-break-after: always;
      break-after: page;
      border: none;
      border-radius: 0;
      box-shadow: none;
      animation: none;
    }

    .chrome,
    .hint,
    .progress {
      display: none !important;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .progress {
      transition: none;
    }
  }
`;
