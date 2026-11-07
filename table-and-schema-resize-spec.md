# Table redesign + resizable schema nodes — spec

Status: draft, ready for implementation
Date: 2026-11-07
Project: Deck Studio (`deck-studio`)

---

## 1. The request, as clarified

> "I want to improve this app, the tables don't look like tables, I want to be able to resize the schema, propose me some improvements."

The interview resolved two separate workstreams:

1. **The Table slide must look like a real grid.** All six complaints were
   confirmed: no vertical dividers, weak header, rows hard to track, cells feel
   like loose text, too airy, nothing lines up.
2. **"Resize the schema" means the boxes on the Diagram slide** — not table
   columns, not row heights. A box should become a resizable **schema node**:
   a title band plus a list of field names, sized by dragging its corners.

Both must hold in the studio preview, the self-contained HTML export and the
PPTX export.

### Decisions taken in the interview

| Topic | Decision |
| --- | --- |
| What "resize" means | Diagram boxes |
| Table problems | All six listed problems |
| Resize UI | Drag in preview **and** numeric fields in the inspector |
| Export parity | HTML and PPTX must match |
| Resize handles | Four corners only |
| Shape proportions | Free size for every shape (ellipse may become an oval) |
| Schema node content | Title band + field rows |
| Table look | One fixed new look, no per-slide style field |
| Table column widths | Auto only; no column dragging this round |
| Field editing | Repeating inspector rows (add / reorder / remove) |
| Field row content | Field name only |
| Node under minimum size | Enforce a minimum size; nothing is ever clipped |
| Table treatments | Vertical hairlines, zebra, header band fill, uniform rows, both-side padding, no trailing gutter |
| Table density | Keep the current type scale (10px headers, 11.5px cells) |
| Existing diagram boxes | Stay plain; schema look appears only when a box has fields |
| Handle visibility | Only the selected box shows corners |
| Snapping | None: free sizing, rounded to whole units |
| Tall rows | All rows grow together to the tallest cell |
| Cell alignment | Auto right-align numeric-looking cells; everything else left |
| Table columns | Raise the cap to 5 evidence columns |
| Recovery | Undo history |
| PPTX table | Native PowerPoint table if fidelity holds, positioned shapes as fallback |
| Header band tint | Dark ink band with paper text |
| Empty cells | Render blank |
| Node limits | Title 40 chars, field 24 chars, max 8 fields |
| Node bounds | Clamp to the 1000×440 drawing, with a minimum size |
| Resize granularity | Free, rounded to whole drawing units |
| Undo scope | Diagram edits only |
| Undo UI | Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z, plus ↶ ↷ in the studio header |
| Label column | Keep mono bold label + small muted detail |
| Schema node header | Follows the box's tone (accent / ink / muted / warm) |

---

## 2. Goals

- A Table slide reads as a table at projector distance: visible grid, a header
  that reads as a header, trackable rows, aligned columns.
- A diagram box can be resized by dragging any of its four corners when
  selected, with the same size available as numbers in the inspector.
- A diagram box with field rows renders as a small schema table (title band +
  field names) in every output.
- Every change survives the round trip: autosave → library → HTML export →
  import → PPTX export.
- Undo/redo for diagram edits, since resizing is a physical gesture and the
  studio has no undo today.

## 3. Non-goals

- No table column dragging, no row-height dragging, no table "zoom".
- No per-slide table style picker (the look is fixed; the data model should not
  pretend otherwise).
- No new diagram shapes, no box-to-box snapping, no collision detection, no
  auto-layout of nodes.
- No undo outside the Diagram slide (text edits, slide operations and deck
  settings stay non-undoable).
- No change to the diagram's arrow model, arrow routing or anchor rules.
- No fonts embedded in PPTX, no PDF writer.
- No increase to the six-box diagram cap. (It becomes more visible as a limit
  once nodes carry field lists; flagged as a follow-up, not part of this work.)

---

## 4. Current state (what the change is working against)

### Table slide

- `src/presentation/components/slides/TableSlide.svelte` — semantic `<table
  class="table">`, editable `<th>`/`<td>` via `EditableText`, label + optional
  detail in the first cell.
- `src/domain/deck/slideLayoutCatalog.ts` — `table` layout at the `id: "table"`
  entry: `rowHeader`, `columns` (`maxItems: 3`), `rows` (`maxItems: 10`, each
  `label` ≤40, `detail` ≤60, `cells` list of ≤3), `note` ≤160.
- `src/design/deck.css` (~line 350) — `border-collapse: collapse`,
  `table-layout: fixed`, `th` 10px uppercase muted with a 1.5px ink bottom
  border, `th:first-child` 28%, `td` 11.5px with `padding: 5px 14px 5px 0` and
  `border-top: 1px solid var(--line)`. No vertical rules, no band fill, no
  zebra, no uniform height.
- `src/infrastructure/export/renderSlideHtml.ts` — `renderTableSlideBody`
  mirrors the preview markup.
- `src/infrastructure/pptx/renderSlideXml.ts` — `renderTableSlide` (~line 703)
  uses `TABLE_LABEL_COLUMN_SHARE = 0.28`, `TABLE_ROW_PADDING = 5`, absolutely
  positioned text boxes and 1px rules. No native table.
- The slide type is `TableSlideContent { eyebrow, heading, rowHeader, columns,
  rows, note }` in `src/domain/deck/slideTypes.ts`.

### Diagram slide

- `src/domain/deck/slideTypes.ts` — `DiagramBox { id, shape, tone, label, x, y }`;
  no size, no field rows.
- `src/shared/diagramSvg.ts` — fixed `SHAPE_SIZES` (`box` 200×84, `ellipse`
  120×120, `diamond` 190×104, `cylinder` 170×104), `SHAPE_TEXT_SHARE` and
  `LABEL_CHAR_WIDTH = 7.6`, `LABEL_MAX_LINES = 3`; `normalizeDiagramBoxes`
  clamps x/y; `diagramShapeSize(shape)` returns the fixed size;
  `diagramAnchor`, `diagramShapePath`, `diagramLabelLines`, `diagramArrow` and
  `buildDiagramSvg` all read that fixed size.
- `src/presentation/components/slides/DiagramSlide.svelte` — SVG preview with
  pointer drag for moves, four mid-side connector dots per box, double-click
  label editing, keyboard nudging, arrow removal. No selection concept.
- `src/presentation/state/PresentationStudio.svelte.ts` — owns deck state,
  `moveDiagramBox(boxIndex, {x,y})`, autosave, notices. No history.
- PPTX renders the diagram SVG to a PNG (`rasteriseSvgToPng`), so node geometry
  automatically follows SVG changes. `svgMarkup.ts` sets an explicit size at
  2× and caps the PNG at 2400px.

---

## 5. Workstream A — Table slide redesign

### 5.1 Visual target

A clean editorial grid, not a spreadsheet. Dark ink header band, hairlines
forming the grid, light zebra, mono row labels with detail beneath, numbers
aligned right.

```
┌──────────────────────────────────────────────────────────────────┐
│ LAYOUT            USE IT WHEN             AVOID IT WHEN          │  ← ink band, paper caps
├──────────────────┬───────────────────────┬───────────────────────┤
│ Cards            │ 3–4 comparable items  │ items need weights    │
│ parallel points  │                       │                       │
├──────────────────┼───────────────────────┼───────────────────────┤  ← zebra row
│ Table            │ 3–10 labelled rows    │ more than 5 columns   │
│ comparison grid  │                       │                       │
├──────────────────┼───────────────────────┼───────────────────────┤
```

### 5.2 Table styling (exact rules)

Applied in `src/design/deck.css`, scoped under `.slide .table`:

- Keep the semantic `<table>` and `table-layout: fixed`.
- `border-collapse: separate; border-spacing: 0` so header fills and cell
  backgrounds paint cleanly (no collapsed-border background quirks).
- **Header band**
  - `th`: `background: var(--ink)` (`#12171f`), `color: var(--paper)`
    (`#f6f4ef`), 10px / 700, `letter-spacing: .12em`, uppercase, left aligned.
  - `padding: 9px 12px`; first header cell `padding-left: 0` so its label
    aligns with the slide heading, while the band still spans the full width.
  - No bottom rule on `th`; the band itself is the rule.
  - Internal header dividers: `1px solid rgba(255, 255, 255, .16)` via
    `border-right` on all `th` except `:last-child`.
- **Body grid**
  - `td`: `padding: 8px 12px`, first `td` `padding-left: 0`.
  - `border-right: 1px solid var(--line)` on all `td` except the last in a row.
  - `border-top: 1px solid var(--line)` on every `td` (row separators), so the
    grid has both directions.
  - `vertical-align: middle`, `font-size: 11.5px`, `line-height: 1.3`,
    `color: var(--ink-soft)`, `overflow-wrap: anywhere`.
- **Zebra**: `tbody tr:nth-child(even) td { background: #fbfaf7; }`. The first
  data row stays white; alternation is on data rows only.
- **Uniform row height**: `<tr>` gets `height: var(--table-row-height)` and the
  value is set inline on the `<table>` by the shared layout helper (see 5.3).
  No row may be shorter or taller than that value; text is vertically centred.
  Do not stretch rows to fill leftover body space — the block sits under the
  heading and the footnote follows it.
- **Label column**
  - `td:first-child .row-label`: mono, 11.5px, 700, `var(--ink)`, single line.
  - `.row-detail`: block, 9.5px, 1.25, `var(--muted)`, one line under the label.
- **Numeric cells**
  - Cells whose trimmed text matches the numeric pattern get
    `class="is-number"`: `text-align: right; font-variant-numeric: tabular-nums;`.
  - Pattern: `/^[+-]?(?:[$€£]\s?)?\d[\d,.\s]*(?:%|k|m|b|x|×|ms|s|px|pt|GB|MB|TB)?$/i`
    on trimmed text, max 24 characters. A date like `2024-01-01` must **not**
    match.
- **Empty cells**: render nothing (no dash, no placeholder). The grid keeps the
  slot visible.
- **Column widths**: label column 28%; remaining width shared equally across
  up to 5 evidence columns. Emit `<colgroup>` with percentage `<col>` widths so
  the studio preview and exported HTML agree; `table-layout: fixed` does the
  rest.
- **Footnote** (`.note`): unchanged, below the table.
- Type scale stays exactly as today: 10px header, 11.5px cell, 11.5px mono
  label, 9.5px detail, 14px footnote.

### 5.3 Shared table layout helper (new)

Add `src/shared/tableLayout.ts`, the single source of truth for geometry used by
the Svelte preview, the HTML renderer and the PPTX renderer. This is what makes
"HTML and PPTX must match" true without measuring the DOM.

```ts
export const TABLE_LABEL_COLUMN_SHARE = 0.28;
export const TABLE_HEADER_HEIGHT = 32;      // px
export const TABLE_ROW_PADDING_Y = 8;       // px, top and bottom
export const TABLE_MIN_ROW_HEIGHT = 34;     // px
export const TABLE_MAX_ROW_HEIGHT = 62;     // px
export const TABLE_MAX_COLUMNS = 5;

export function isNumericCell(text: string): boolean;
export function tableColumnShares(columnCount: number): number[]; // [0.28, ...equal]
export function tableRowHeight(content: TableSlideContent): number; // uniform, clamped
export interface TableLayout {
  columnShares: number[];
  rowHeight: number;
  headerHeight: number;
  overflowsStage: boolean; // drives the validation warning
}
export function computeTableLayout(content: TableSlideContent): TableLayout;
```

Row height estimate (deliberately conservative, mirrors the PPTX text
measurement constants):

- Characters per line per column:
  - label: `floor((0.28 * 1144 - 24) / 6.9)` for mono 11.5px;
  - detail: `floor((0.28 * 1144 - 24) / 5.5)` for 9.5px sans;
  - cell: `floor((share * 1144 - 24) / 6.2)` for 11.5px sans.
- Lines per cell = `ceil(length / charsPerLine)` on word boundaries (same
  wrapping intent as `wrapDiagramLabel`).
- Row need = `paddingY * 2 + lines * lineHeight` (line heights 14.95 / 11.9 /
  14.95).
- `rowHeight = clamp(TABLE_MIN_ROW_HEIGHT, max over all rows, TABLE_MAX_ROW_HEIGHT)`.
- `overflowsStage` when
  `TABLE_HEADER_HEIGHT + rowHeight * rows + footnote > 470` (the body region at
  1280×720 with the current heading and footnote spacing). Do not shrink below
  34px silently; warning instead.

### 5.4 Markup

Preview (`TableSlide.svelte`) and HTML (`renderTableSlideBody`) produce the same
structure:

```html
<table class="table" style="--table-row-height: 46px">
  <colgroup>
    <col style="width: 28%" />
    <col style="width: 24%" /> <!-- remaining shares -->
  </colgroup>
  <thead>
    <tr><th>Item</th><th>Today</th><th>With the change</th></tr>
  </thead>
  <tbody>
    <tr>
      <td>
        <span class="row-label">Cards</span>
        <span class="row-detail">parallel points</span>
      </td>
      <td>3–4 comparable items</td>
      <td class="is-number">42%</td>
    </tr>
  </tbody>
</table>
```

- The style attribute is the only inline geometry; all decoration stays in
  `deck.css`, which is exported verbatim.
- `EditableText` still renders `<th>` / `<td>` in the preview; `is-number` is a
  class on the editable element (`class:is-number={isNumericCell(cell)}`).
- Rows pad missing cells with empty strings, as today.

### 5.5 Schema

`slideLayoutCatalog.ts`:

- `columns.maxItems` becomes `5` (was 3); `rows.itemFields.cells` `maxItems`
  becomes `5` so a row can hold all five evidence columns.
- Import paths accept 4–5 columns already, so older decks are unaffected.

### 5.6 PPTX (native table, with fallback)

Add `src/infrastructure/pptx/pptxTable.ts` and replace the absolute-position
table code in `renderSlideXml.ts`.

- Emit a `<p:graphicFrame>` containing `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl>`.
- `tblPr` with `firstRow="0" bandRow="0"` so PowerPoint's built-in table style
  cannot repaint the cells; every fill and border is explicit.
- `a:tblGrid` uses the same column shares from `computeTableLayout`, converted
  with `toEmu`.
- Header row: fill `12171F`, text `F6F4EF`, bold, 7.5pt (10px), letter spacing
  ~1.5pt, left aligned.
- Body cells: 8.6pt (11.5px), vertical anchor `ctr`, cell margins
  `marL=marR=12px`, `marT=marB=8px`; zebra rows fill `FBFAF7`; horizontal and
  vertical borders 1px in `D9D6CF`; row heights use the shared `rowHeight`.
- Label cell carries two paragraphs: mono bold label + 7.1pt muted detail.
- Numeric cells use `algn="r"`.
- **Fidelity rule**: use the native table when `overflowsStage === false`.
  When it is true, fall back to the existing positioned-shape renderer (keep the
  old function, renamed `renderTableSlideWithShapes`) so an over-full table still
  exports legibly instead of being auto-grown by PowerPoint. The fallback shares
  the same `computeTableLayout` geometry.
- Verify against a 5-column, 10-row table: column widths, header band, zebra,
  borders and row heights must match the HTML export. If native tables cannot
  hold that fidelity, the documented fallback is positioned shapes for all
  tables (the option chosen in the interview).

---

## 6. Workstream B — Resizable schema nodes

### 6.1 Data model

`src/domain/deck/slideTypes.ts`:

```ts
export interface DiagramBox {
  id: string;
  shape: DiagramShape;
  tone: DiagramTone;
  label: string;
  x: number;
  y: number;
  /** Drawing units; absent in older decks, filled by normalizeDiagramBoxes. */
  width?: number;
  height?: number;
  /** Field names rendered under the title band; empty/absent = plain box. */
  fields?: string[];
}
```

Limits: title ≤ 40 chars (unchanged), field ≤ 24 chars, `fields` ≤ 8.

### 6.2 Normalisation and geometry (back-compatible)

In `src/shared/diagramSvg.ts`:

- Export the per-shape default sizes (today `SHAPE_SIZES`) so they can be used
  as fallbacks: `diagramDefaultSize(shape)`.
- `normalizeDiagramBoxes(boxes)` gains:
  - `width`/`height` fall back to the shape default; non-finite or ≤0 values
    fall back too;
  - clamp `width ≤ DIAGRAM_WIDTH - x`, `height ≤ DIAGRAM_HEIGHT - y`, and
    `width`/`height` ≥ the node's minimum (6.4);
  - `fields`: keep only non-empty trimmed strings, slice to 8, each sliced to
    24; absent becomes `[]`;
  - x/y clamping uses the *resolved* width/height instead of the shape default,
    so a resized box can never hang off the canvas.
- `diagramShapeSize(box: DiagramBox)` becomes the single accessor used
  everywhere (it currently takes a shape). Keep a shape-only variant for the
  catalogue defaults, but all drawing code uses the box.
- `diagramAnchor`, `diagramShapePath`, `diagramLabelLines` already derive from
  the size; pointing them at `diagramShapeSize(box)` is the whole change.
- `diagramLabelLines` keeps the 3-line/ellipsis rule and the per-shape text
  share, now based on the actual width. For schema nodes the label lives in the
  header band and is handled separately (6.3), not by the wrapped label path.

### 6.3 Schema node rendering (SVG + preview)

A box renders as a **schema node** when `fields.length > 0`; otherwise it keeps
today's plain shape and wrapped label (decision: "stay plain").

**Geometry** (drawing units, 1000×440 canvas):

- Node outline: rounded rectangle, radius 6, unlike the plain box's radius 8.
- Header band height: 30. Body: `fields.length * 24 + 8` padding (4 top, 4
  bottom). Total height = 30 + body; the stored `height` includes both.
- Title: sans 13px, 600, paper-coloured text, 10px left padding, vertically
  centred in the band, single line with ellipsis if it cannot fit.
- Field rows: mono 11px, 10px left padding, 24px row height, vertically
  centred, one hairline separator above each row (inset 8px on both sides).
- **Tone mapping** (interview: header follows the box tone):
  - header fill = the tone's stroke colour from `diagramBoxStyle`;
  - header text = `colors.paper` for `accent`, `emphasis`, `muted`, `warm`; the
    tone's text colour for `ink` (which has a paper fill and ink stroke, so its
    header band is inverted: ink band, paper text);
  - body fill = the tone's `fill`; body outline = the tone's `stroke`;
  - field text = the tone's `text`; separators `#d9d6cf`, or
    `rgba(255,255,255,.24)` on the emphasis tone.
- **Minimum size** (prevents clipping, decision "enforce a minimum"):
  - `minWidth = clamp(160, max(measure(title), measure(longestField)) + 32, 380)`,
    with title measured at ~7.2 units/char and fields at ~6.6 units/char;
  - `minHeight = 30 + max(1, fields.length) * 24 + 10`;
  - plain boxes keep their shape's default size as the minimum.
  - The same helper is used by the drag, the inspector clamp and the normaliser.
- Header band and body share one path so arrows and anchors stay on the bbox
  mid-sides; anchors remain valid because they are bbox mid-sides (a diamond's
  vertices are the bbox mid-sides, preserved by free resizing).

**Both renderers:**

- `buildDiagramSvg` draws schema nodes inside the existing `<g>`; no new SVG
  features (no filters, no foreignObject), so the PPTX rasteriser keeps working.
- The Svelte preview gains a `{@snippet}` equivalent (`schemaNode`), drawing the
  same geometry with the same constants, so preview and export cannot drift.

### 6.4 Selection

- New studio state: `selectedDiagramBoxId: string | null`, cleared on slide
  selection, deck switch, new deck and import.
- `DiagramSlide` receives `selectedBoxId`, `onSelectBox(id | null)`,
  `onResizeBox(index, {x, y, width, height})`.
- Clicking a box selects it (and still starts the move drag as today).
  Clicking empty SVG canvas deselects. Double-click still renames; the editor
  overlay is positioned over the **header band** for schema nodes and over the
  whole shape for plain boxes.
- Clicking a box also does not disturb connector dots or arrow hit areas:
  hit-testing priority is **corner handle → connector dot → arrow → box →
  canvas**.

### 6.5 Corner resize interaction

- Only the selected box draws four corner handles.
- Handles are 10 units square (≈10px at preview scale), drawn with a 16-unit
  transparent hit circle for touch, `cursor: nwse-resize` on the top-left and
  bottom-right, `nesw-resize` on the other two.
- Handles sit 4 units outside the bbox so they do not overlap the connector
  dots at the mid-sides.
- Pointer down on a handle: `stopPropagation`, `setPointerCapture`, record the
  opposite corner as the fixed anchor.
- Pointer move: compute the rect from the anchor to the pointer, round `width`
  and `height` to whole units, enforce the node minimum, clamp to `1000×440`
  (so `x + width ≤ 1000`, `y + height ≤ 440`), and preview the box live.
- Pointer up: commit `{x, y, width, height}` through `onResizeBox`; a click
  without movement commits nothing (no autosave churn). Release capture.
- Escape during a resize cancels and restores the starting rect.
- Moving and resizing are both free; values are rounded to whole units on commit.
- No handles in the exported HTML, in presentation mode or on the welcome page
  (the `onMoveBox`/`canEdit` gate already provides this).

### 6.6 Inspector

The catalogue's `diagram.boxes.itemFields` becomes:

1. `label` — "Title", max 40 (relabel from "Label").
2. `shape` — unchanged select.
3. `tone` — unchanged select ("Colour").
4. `width` — new **number** field: min = node min width, max 1000, step 10,
   label "Width".
5. `height` — new number field: min = node min height, max 440, step 10,
   label "Height".
6. `fields` — text list: item label "Field", `maxItems: 8`, `maxLength: 24`,
   `defaultItems: []`.

Supporting changes:

- Add `NumberFieldDefinition` to `slideLayoutCatalog.ts`
  (`type: "number"`, `min`, `max`, `step`, `defaultValue`) and include it in
  `FieldDefinition`.
- Extend `createValuesForFields` and `findFieldAtPath` to handle `number`.
- `FieldEditor.svelte` renders `<input type="number">` with min/max/step and
  commits a parsed number (not a string) through `onChange`; empty input is
  ignored (keep the last value) rather than committing `NaN`.
- Width/height inputs must reflect drag results immediately: they read from
  `box.width`/`box.height`, which the resize commits. No local mirror.
- When `selectedDiagramBoxId` matches a box's id, that box's inspector item
  header gets an `is-selected` class, so the panel and the preview agree on
  which node is being edited.
- Inspector display order follows the modern field order above; existing decks
  are unaffected because the schema is declarative.

### 6.7 Starter deck and README

- `src/application/createStarterDeck.ts`: turn the tour diagram's `Schema`
  box into a schema node with 3 fields (`id`, `title`, `owner_id`) so the new
  capability is discoverable; note text mentions resizing. The table tour slide
  keeps its content (the new styling demonstrates itself) and its note stays.
- `README.md`: update the Table layout description, the Diagram description
  (resize corners, schema nodes), the layout list and "Limits worth knowing"
  (5 columns, 8 fields, 40/24 caps, free sizing, diagram-only undo).

---

## 7. Undo / redo (diagram edits only)

- State lives in `PresentationStudio`:

```ts
interface DiagramHistoryEntry {
  slideId: string;
  boxes: DiagramBox[];
  links: DiagramLink[];
  routing: DiagramRouting;
}
undoStack: DiagramHistoryEntry[];  // cap 50
redoStack: DiagramHistoryEntry[];
```

- Push a snapshot **before** each diagram mutation: box move commit, box resize
  commit, and inspector edits to any `boxes.*` path (label, shape, tone, width,
  height, fields add/remove/reorder).
- Coalesce consecutive text edits on the same path within 500ms into one entry
  (typing a 40-character title must not create 40 undo steps).
- Every new mutation clears `redoStack`; undo pushes the current state onto the
  redo stack and applies the previous snapshot; redo is the mirror.
- Undo/redo also selects the entry's slide, so the change is visible.
- History is session-only: cleared on deck switch, new deck, import and page
  reload (nothing is added to the persisted deck schema).
- UI: `StudioHeader` gains ↶ and ↷ icon buttons with `aria-label="Undo"` /
  `"Redo"` and `title` naming the shortcut; disabled when the respective stack
  is empty. They sit beside the save indicator, before Import.
- Keyboard in `App.svelte`: Cmd/Ctrl+Z = undo, Shift+Cmd/Ctrl+Z (and Ctrl+Y) =
  redo. Ignore while `isTypingTarget(event.target)` is true; `preventDefault`
  only when a diagram is selected and an action is available, so the browser's
  native undo still works in ordinary inputs.
- Out of scope by decision: undoing text edits on other layouts, slide
  operations and deck settings.

---

## 8. Validation and warnings

`src/domain/deck/deckProblems.ts`:

- Table: warning when `computeTableLayout(content).overflowsStage` —
  "Slide N (Table): the table needs more height than the stage has; shorten
  cells or remove a row."
- Table: no warning for empty cells (rendered blank by decision).
- Diagram: warning when a schema node has more than 8 fields or a field longer
  than 24 characters after import normalisation (should not happen through the
  UI, but imported JSON can).
- Diagram: warning when a box was clamped below its content minimum on import —
  "Slide N: a schema node was too small and has been enlarged to fit." Keep it
  a warning, never an error, so import never blocks.
- Errors and existing rules are unchanged.

---

## 9. Edge cases and compatibility

| Case | Behaviour |
| --- | --- |
| Deck saved before this change | Boxes get default size and `fields: []`; they render exactly as today. Tables get the new look automatically; content untouched. |
| Box with 1–8 fields | Renders as a schema node; header band follows tone. |
| Box with 0 fields | Plain shape, wrapped label, as today; still resizable. |
| Ellipse resized | Becomes an oval; label wrap width follows the new width; anchors stay bbox mid-sides. |
| Diamond resized narrow | Allowed down to its content minimum; arrows still join at mid-sides (the diamond's vertices). |
| Resize past canvas | Clamped in the drag, in the inspector and in `normalizeDiagramBoxes`. |
| Delete a box referenced by a link | Existing `normalizeDiagramLinks` drops the link; resizing does not touch links. |
| Table with 0 evidence columns | Header + label column only; grid still renders, no crash. |
| Table with 5 columns and 10 rows | Fits at the computed row height or raises the overflow warning; PPTX falls back to shapes if it does not fit. |
| Long cell text | Rows all grow to the tallest; above the max row height the warning fires and the PPTX fallback keeps geometry. |
| Numbers with units (`42%`, `1,200`, `$8m`) | Right aligned via `isNumericCell`. |
| Dates (`2024-01-01`) | Left aligned. |
| Empty cell | Blank. |
| Undo after switching slides | Restores the entry's slide and selects it. |
| Undo while a contenteditable has focus | Not captured by the shortcut; native text undo applies. |
| Presentation mode / exported HTML | No handles, no selection outline, no undo UI. |
| Print (A4 landscape) | Grid and zebra print as-is; no interactive artefacts. |

---

## 10. File-by-file change plan

| File | Change |
| --- | --- |
| `src/domain/deck/slideTypes.ts` | `DiagramBox.width?`, `.height?`, `.fields?`. |
| `src/domain/deck/slideLayoutCatalog.ts` | `NumberFieldDefinition`; table `columns`/`cells` max 5; diagram box fields (width, height, fields list; "Title" label). |
| `src/domain/deck/deckProblems.ts` | Table overflow warning; schema node import warnings. |
| `src/shared/tableLayout.ts` (new) | Column shares, numeric detection, uniform row height, overflow flag. |
| `src/shared/diagramSvg.ts` | Default sizes, min-size helper, schema node geometry, size/fields normalisation, drawing with resolved size. |
| `src/presentation/components/slides/TableSlide.svelte` | `<colgroup>`, row-height CSS var, `is-number` classes. |
| `src/presentation/components/slides/DiagramSlide.svelte` | Selection, corner handles, resize gesture with free sizing, schema node snippet, header rename overlay. |
| `src/presentation/components/FieldEditor.svelte` | Number input branch. |
| `src/presentation/components/PreviewStage.svelte` | Pass through selection/resize props. |
| `src/presentation/components/SlideSurface.svelte` | Pass through diagram props; preview-only editability context unchanged. |
| `src/presentation/components/StudioHeader.svelte` | Undo/redo buttons. |
| `src/presentation/state/PresentationStudio.svelte.ts` | `selectedDiagramBoxId`, `resizeDiagramBox`, selection lifecycle, undo/redo stacks and coalescing. |
| `src/App.svelte` | Pass new props; Cmd/Ctrl+Z shortcuts. |
| `src/application/createStarterDeck.ts` | Tour schema node + resize note. |
| `src/design/deck.css` | Table grid, header band, zebra, hairlines, uniform height, numeric alignment; schema node needs no CSS (SVG). |
| `src/infrastructure/export/renderSlideHtml.ts` | New table markup with `<colgroup>` and inline row height. |
| `src/infrastructure/pptx/pptxTable.ts` (new) | Native `a:tbl` graphicFrame. |
| `src/infrastructure/pptx/renderSlideXml.ts` | Use native table when it fits, keep positioned-shape fallback. |
| `README.md` | Feature and limits updates. |

No new dependencies. No test runner is added; the project has none today.

---

## 11. Acceptance criteria

1. **Grid legibility** — A Table slide on the 1280×720 stage shows an ink
   header band with paper uppercase labels, vertical hairlines between every
   column, horizontal row rules, zebra data rows, a mono label with detail
   underneath, and both-side cell padding.
2. **Uniform rows** — Every data row has exactly `--table-row-height`; the
   tallest cell in the table sets that value; nothing is clipped.
3. **Numeric alignment** — `42%`, `1,200`, `$8m` and `12ms` right-align with
   tabular figures; prose and dates stay left.
4. **Five columns** — A table with five evidence columns lays out evenly with
   the label column at 28%; the inspector enforces the cap.
5. **HTML parity** — Exporting the deck produces a table visually identical to
   the preview (same `deck.css`, same inline row height), with no studio
   artefacts.
6. **PPTX parity** — The exported `.pptx` opens in PowerPoint as a native table
   whose column widths, header band, zebra fills, borders and row heights match
   the HTML; every cell's text is editable. If the table does not fit the stage,
   the positioned-shape fallback is used instead of an auto-grown table.
7. **Selection** — Clicking a diagram box selects it and shows exactly four
   corner handles; clicking empty canvas removes them.
8. **Resize** — Dragging a corner keeps the opposite corner fixed, rounds
   width/height to whole units, obeys the content minimum, and never leaves the
   1000×440 canvas; the inspector's Width/Height fields update live and are
   themselves editable.
9. **Schema node** — A box with fields renders as a tone-coloured header band
   plus mono field rows in the preview, HTML (SVG) and PPTX (rasterised PNG);
   the title/field caps are 40/24 with at most 8 rows.
10. **Back-compatible** — An old deck loads with plain, default-sized diagram
    boxes and the new table look, with no content rewrite.
11. **Undo** — Cmd/Ctrl+Z and Shift+Cmd/Ctrl+Z (plus the header buttons) undo
    and redo diagram moves, resizes and field edits, one step per gesture; no
    history is added to the saved deck or to non-diagram edits.
12. **Checks** — `npm run check` (svelte-check, strict) and `npm run build`
    pass.

## 12. Verification plan

1. `npm run check` and `npm run build`.
2. In the studio, on the starter deck's Table slide: add three more columns and
   rows up to the cap; confirm the grid, zebra, uniform heights, numeric
   alignment and label/detail rendering; confirm the overflow warning appears
   when content no longer fits.
3. Export HTML, open the file from disk, confirm the table matches the preview;
   print preview shows one slide per A4-landscape page; arrow keys still work.
4. Export PPTX, open in PowerPoint: confirm a native table, editable text,
   matching fills/borders/widths/heights; check the fallback by filling every
   cell with long text.
5. On the Diagram slide: select a box, drag each corner, confirm free sizing,
   minimum size, canvas clamping and that arrows follow. Enter Width/Height in
   the inspector and confirm the preview follows.
6. Add 3 fields to a box, confirm the schema node header/fill/rows in preview,
   HTML and PPTX; check tone variants (accent, emphasis, ink, muted, warm).
7. Undo/redo: resize, move, rename and add a field; step back and forward with
   both the shortcuts and the header buttons; confirm a move gesture is one
   step.
8. Legacy check: import a deck JSON produced before the change (no `width`,
   `height`, `fields`); confirm it loads with plain boxes and no warnings.
9. Presentation mode and the welcome page: confirm no handles, no selection
   outline, no undo buttons.
10. Confirm the exported HTML contains no studio-only markup (no handles,
    no `is-editable` classes).

## 13. Risks and follow-ups

- **Native PPTX tables** auto-grow rows when text does not fit and enforce their
  own minimum row height. The geometry helper is conservative, and the fallback
  to positioned shapes is the safety valve; verify with the 5-column/10-row
  case before shipping.
- **Uniform row height** via a fixed inline height is deliberate: it keeps HTML
  and PPTX deterministic and avoids DOM measurement in the exporter. The
  trade-off is a table that does not stretch to fill the body when it is short —
  acceptable in the editorial layout.
- **Six-box diagram cap** becomes tighter once nodes carry fields. Raising it is
  a natural follow-up but is not part of this request.
- **Undo only for diagrams** is inconsistent with the rest of the studio. A
  future global history could reuse the snapshot stack, but the deck schema must
  not start storing history.
- **Numeric detection** is heuristic. If a legitimate label like `Q3 2024`
  right-aligns, tighten the pattern rather than adding a per-column alignment
  control (per-column alignment was explicitly not chosen).
