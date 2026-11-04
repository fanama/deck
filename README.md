# Deck Studio

Author structured presentations in the browser and export them as **one
self-contained HTML file** — no build step for the reader, no network, no
dependencies. The exported deck opens from disk, presents with the arrow keys
and prints one slide per A4-landscape page.

The whole project is TypeScript with `strict` enabled, including every Svelte
component and the rune-backed state module.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
npm run check    # svelte-check: components + TS modules, strict
npm run build    # static build in dist/
```

The studio keeps your deck in `localStorage` (key `deck-studio.deck.v1`) and
autosaves shortly after every change. **Export HTML** downloads the deck; the
file name comes from the deck title.

## What the studio does

The app opens on a welcome page with its own header and footer: it states what
the product does, shows the first slide of your current deck, and links to the
source on GitHub (`github.com/fanama`) from the header. **Open the studio** (or
`Enter`) enters the editor, and the brand in the studio header brings you back
to the welcome page without losing the deck.

- Seven layouts — Title, Cards, Flow, Rules, Statement, Technical, Closing.
- A schema-driven inspector: each layout declares its fields, so text, lists
  and nested lists are all edited through the same component.
- A 1280×720 preview that uses the same stylesheet as the export, so what you
  see is what the file renders.
- Deck-level title, footer label and a single accent colour; tints, the title
  gradient and pill borders are derived from it.
- Validation before export: an empty heading or a missing deck title blocks;
  over-long headings and blocks warn.
- **Import deck** reads a `.json` deck file or any HTML file this studio
  exported — the deck data travels inside the exported document, so the file
  you sent is the file you can edit again.
- **Present** from the studio (button, or `P`): the deck fills the screen on
  its own 1280×720 stage, with a progress bar and counter. Arrows, space,
  Page Up/Down and Home/End move, `Esc` returns to editing, and the page goes
  full screen when the browser allows it.
- Reordering, duplicating and deleting slides; arrow-key navigation.
- **Export PPTX** writes the same deck as a native PowerPoint file: every
  heading is an editable text box, every card and rule a native shape, and the
  deck accent becomes the theme's accent colour.

## Types

`domain/deck/slideTypes.ts` is the single description of the data model:

- `SlideContentByLayout` maps each layout id to its content interface.
- `Slide` is a discriminated union on `layout`, so narrowing `slide.layout`
  gives the preview and the HTML renderer the exact content type.
- `Deck` is the aggregate; `ContentPath` is the `string | number` path used by
  the inspector to address any field, at any nesting depth.

Ports are interfaces (`DeckRepository`, `DeckExporter`, `DeckPptxExporter`) and
adapters are typed against them, so swapping storage or either exporter is a
type-checked change.

## Architecture

Dependencies point inwards only: `presentation → application → domain`, with
`infrastructure` implementing ports defined by the domain. The domain has no
browser or framework imports.

```
src/
├── domain/deck/
│   ├── slideTypes.ts            slide union, content interfaces, Deck, paths
│   ├── Deck.ts                  deck aggregate: slide operations, restore
│   ├── slideLayoutCatalog.ts    layout schemas, defaults, empty list items
│   ├── deckTheme.ts             theme value object, colour mixing, CSS vars
│   └── deckProblems.ts          validation rules (errors vs warnings)
├── domain/ports/
│   ├── deckRepositoryPort.ts    saveDeck / loadDeck / clearDeck
│   └── deckExporterPort.ts      exportDeckToHtml
├── application/
│   ├── createStarterDeck.ts     starter deck + createNewDeck
│   ├── loadSavedDeck.ts         restore through the repository port
│   ├── saveDeck.ts              persist, report instead of throw
│   └── exportDeckAsHtmlFile.ts  validate, export, name the file
├── infrastructure/
│   ├── persistence/localStorageDeckRepository.ts
│   ├── export/htmlDeckExporter.ts     documents, theme vars, navigation
│   ├── export/renderSlideHtml.ts      one renderer per layout
│   ├── export/deckDocumentCss.ts      viewport, chrome, print rules
│   ├── export/deckNavigationScript.ts written into every deck
│   ├── pptx/pptxDeckExporter.ts      OPC package for PowerPoint
│   ├── pptx/renderSlideXml.ts        one DrawingML renderer per layout
│   ├── pptx/pptxPackageParts.ts      presentation, master, layout, theme
│   ├── pptx/zipArchive.ts            dependency-free store-only zip
│   ├── browser/downloadTextFile.ts
│   └── browser/downloadBinaryFile.ts
├── presentation/
│   ├── state/PresentationStudio.svelte.ts  selection, autosave, notices
│   └── components/                          shell, panels, preview, layouts
├── design/deck.css              the one stylesheet, also exported verbatim
└── shared/                      escapeHtml, immutable path helpers, slug
```

`design/deck.css` is imported twice on purpose: as CSS for the preview and as a
raw string (`?raw`) by the exporter. One file, one source of truth for how a
slide looks.

## Adding a layout

1. Add an entry to `SLIDE_LAYOUTS` in `domain/deck/slideLayoutCatalog.ts`
   (fields, defaults, `shellClass`, `purpose`).
2. Add the content interface to `SlideContentByLayout` in
   `domain/deck/slideTypes.ts`.
3. Add a preview component in `presentation/components/slides/` and a branch in
   `SlideSurface.svelte`.
4. Add a renderer function to `renderSlideHtml.ts` and one to
   `src/infrastructure/pptx/renderSlideXml.ts`, with a case in each
   `renderSlideBody`. Presentation formats differ, so the two renderers are
   kept apart on purpose: one writes HTML, the other DrawingML.

The inspector needs no change: it renders whatever fields the catalogue
declares, at any nesting depth.

## Limits worth knowing

- One deck per browser profile; there is no multi-deck library yet.
- Text is plain — no bold, links or images inside a slide.
- Slide content is capped by the schema (headings ~100 characters, cards 4,
  lanes 3, nodes per lane 5) to keep the 1280×720 stage readable.
- Import recognises deck data embedded by this studio. An HTML deck exported
  by an older version, or rewritten by another tool, cannot be imported.
- The PPTX uses one master and one blank layout with absolutely positioned
  text, so a paragraph edited long enough to rewrap can push past its
  neighbour. Fonts travel by name (Georgia, Arial, Consolas), not embedded.
- There is no PDF writer; print the exported HTML instead.
