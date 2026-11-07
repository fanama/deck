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

The studio keeps a **library of decks** in `localStorage` (key
`deck-studio.library.v1`) and autosaves shortly after every change. A library
written by an earlier single-deck build (`deck-studio.deck.v1`) is read once
and becomes the first deck. **Export HTML** downloads the open deck; the file
name comes from its title.

## What the studio does

The app opens on a welcome page with its own header and footer: it states what
the product does, shows the first slide of your current deck, and links to the
source on GitHub (`github.com/fanama`) from the header. **Open the studio** (or
`Enter`) enters the editor, and the brand in the studio header brings you back
to the welcome page without losing the deck.

- Nine layouts — Title, Cards, Flow, Rules, Statement, Technical, Table,
  Diagram, Closing — and a starter deck that is a tour of them: one slide per
  layout, each saying what the layout is for.
- A table that reads as a grid: an ink header band, vertical hairlines, zebra
  rows, uniform row heights, mono labels with detail beneath and numbers
  right-aligned automatically. Up to five evidence columns share the width
  evenly beside the label column.
- Several decks at once: the **Decks** panel lists what this browser holds,
  switches the open one and deletes one; **New deck** adds another without
  replacing anything. Each deck keeps its own slides, title and accent.- A **Diagram** slide is edited by dragging: boxes move in the preview (arrow
  keys nudge a focused one), double-click renames one, and arrows are drawn by
  dragging from one of a box's four dots — top, right, bottom, left — onto
  another box. Each arrow leaves from the side nearest its target and lands on
  the nearest side of that target, the way draw.io resolves a straight floating
  connection. **Arrows** in the inspector draws every arrow either straight or
  as a 90° elbow, mid-way between the two boxes. Click an arrow to remove it;
  from the keyboard, `Enter` on a dot then `Enter` on the target box links the
  two. Select a box to get four corner handles and drag one to resize it: sizes
  are free, rounded to whole units, never drop below what the content needs and
  stay on the 1000×440 drawing. The inspector mirrors the size as Width and
  Height fields. Drag a box onto another to nest it: the container keeps its
  title at the top left, children paint on top and move with it, and dragging a
  child onto empty canvas takes it back out. Shift-click selects several boxes;
  **Group** in the inspector makes them move together, **Ungroup** splits them.
  The drawing zooms from 100% to 300% with the − / + controls in its top-right
  corner; when zoomed in, drag empty canvas to pan and **Reset** returns to fit.
  Zoom is a studio view only — the exported deck and the PPTX keep the full
  drawing.
  A box with **field rows** becomes a schema node: a title band in the box's
  tone, then one mono row per field, up to eight. Each box is a rectangle, a
  circle, a diamond or a cylinder, with its own colour tone — accent by default,
  plus emphasis (a filled box), ink, muted and warm — both chosen in the
  inspector. The drawing is generated as SVG, so the HTML export stays vector;
  the PPTX export rasterises it, because PowerPoint pictures must be bitmaps
  there.
- Diagram edits have **undo and redo** (Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z, or the
  arrows in the studio header): box moves, resizes and field-row edits, one
  step per gesture. History lives in the session, not in the deck.
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
  you sent is the file you can edit again. An imported deck joins the library;
  importing the same deck twice gives the second copy a fresh id.
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
│   ├── deckRepositoryPort.ts    DeckLibrary: saveLibrary / loadLibrary / clearAll
│   └── deckExporterPort.ts      exportDeckToHtml
├── application/
│   ├── createStarterDeck.ts     layout-tour starter deck + createNewDeck
│   ├── loadSavedDecks.ts        restore every deck through the port
│   ├── saveDeckLibrary.ts       persist the library, report instead of throw
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

- The library lives in one browser profile: no account, no sync, no folders.
  Decks are added and deleted whole; there is no duplicate-deck command beyond
  **New deck**.
- Text is plain — no bold or links inside a slide.
- A diagram lives on one slide: six boxes, each freely resizable within a
  content-derived minimum, labels of up to 40 characters wrapped to three lines
  (or a title band of the same length plus up to eight field names of 24
  characters), and arrows with no label of their own. Arrows are explicit
  links, so one box can feed several others. Boxes may nest; a parent carries
  its children when it moves, and resizing it keeps them inside. A group shares
  movement only — each box keeps its own size and links.
- The table caps at five evidence columns and ten rows. When the grid no longer
  fits the stage, the inspector warns; the PPTX export then falls back to
  positioned shapes instead of letting PowerPoint grow the rows.
- Box colours are five fixed tones rather than an arbitrary colour picker, so a
  diagram keeps matching whatever accent the deck uses.
- Slide content is capped by the schema (headings ~100 characters, cards 4,
  lanes 3, nodes per lane 5) to keep the 1280×720 stage readable.
- Import recognises deck data embedded by this studio. An HTML deck exported
  by an older version, or rewritten by another tool, cannot be imported.
- The PPTX uses one master and one blank layout with absolutely positioned
  text, so a paragraph edited long enough to rewrap can push past its
  neighbour. Fonts travel by name (Georgia, Arial, Consolas), not embedded.
  Diagram slides are the one rasterised element: the SVG is drawn to a PNG
  when the file is written, so it is a picture in PowerPoint, not shapes.
- There is no PDF writer; print the exported HTML instead.
