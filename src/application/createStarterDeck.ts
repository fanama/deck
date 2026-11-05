import { createBlankSlide, createDeck } from "../domain/deck/Deck.ts";
import { DEFAULT_ACCENT_COLOR } from "../domain/deck/deckTheme.ts";
import type { Deck, Slide, SlideContentByLayout, SlideLayoutId } from "../domain/deck/slideTypes.ts";

function slideWithContent<Layout extends SlideLayoutId>(
  layoutId: Layout,
  content: SlideContentByLayout[Layout],
): Slide {
  return { ...createBlankSlide(layoutId), content } as Slide;
}

/**
 * The deck the studio opens with: the catalogue of layouts, one slide each,
 * so a first-time author can see what every layout is for before writing.
 * Each slide demonstrates its own layout and nothing else.
 */
export function createStarterDeck(): Deck {
  const slides: Slide[] = [
    slideWithContent("title", {
      eyebrow: "DECK STUDIO · LAYOUT TOUR",
      heading: "Nine layouts, one self-contained deck.",
      lede: "This starter deck is the catalogue: one slide per layout, each saying what it is for. Edit any field in the inspector, drag a diagram, or start a deck of your own — this one stays in the library.",
      pills: ["One HTML file", "PowerPoint export", "No dependencies"],
      meta: [
        { label: "What this is", value: "A tour of the nine layouts" },
        { label: "How to read it", value: "One layout per slide" },
        { label: "What to do next", value: "New deck, then write yours" },
      ],
    }),
    slideWithContent("cards", {
      eyebrow: "LAYOUT 02 · CARDS",
      heading: "Cards: two to four points, side by side.",
      cards: [
        {
          marker: "01",
          title: "Compare",
          body: "Pains, options or consequences that only mean something together.",
        },
        {
          marker: "02",
          title: "Bound",
          body: "Up to four cards. A fifth belongs on a table, not a wider row.",
        },
        {
          marker: "03",
          title: "Cut",
          body: "A card that survives on its own was never a card: make it a statement.",
        },
      ],
      note: "Cards are for comparison; one argument alone is a statement.",
    }),
    slideWithContent("flow", {
      eyebrow: "LAYOUT 03 · FLOW",
      heading: "Flow: two lanes of four short steps.",
      lanes: [
        {
          label: "Authoring",
          nodes: [
            { title: "Pick a layout", detail: "nine schemas" },
            { title: "Fill the fields", detail: "inspector only" },
            { title: "Read the warnings", detail: "before export" },
            { title: "Export", detail: "one document" },
          ],
        },
        {
          label: "Presenting",
          nodes: [
            { title: "Open the file", detail: "from disk" },
            { title: "Arrow through", detail: "hash keeps place" },
            { title: "Print", detail: "one slide per page" },
            { title: "Share", detail: "no account" },
          ],
        },
      ],
      note: "Each lane is a row of up to five steps; the two lanes compare, they do not branch.",
    }),
    slideWithContent("rules", {
      eyebrow: "LAYOUT 04 · RULES",
      heading: "Rules: guardrails, each with its own cost.",
      rules: [
        {
          marker: "1",
          statement: "One idea per slide. Two ideas share the audience's attention and lose both.",
        },
        {
          marker: "2",
          statement: "A heading states a claim. A topic name is a slide nobody can argue with.",
        },
        {
          marker: "3",
          statement: "A figure keeps its context — machine, corpus, conditions — or it invites a wrong reading.",
        },
      ],
      note: "Rules are read while someone talks; three is already a lot.",
    }),
    slideWithContent("statement", {
      eyebrow: "LAYOUT 05 · STATEMENT",
      heading: "Statement: one figure and the points behind it.",
      points: [
        "A claim the number supports, not a number looking for a claim.",
        "Each point fits on one line at projector size.",
        "The last point says what the figure does not.",
      ],
      figure: "09",
      figureCaption: "layouts in the catalogue, each declaring its own fields and defaults.",
    }),
    slideWithContent("technical", {
      eyebrow: "LAYOUT 06 · TECHNICAL",
      heading: "Technical: the one mechanism a reader will test.",
      points: [
        "The dark shell marks a slide that earns close reading.",
        "Every claim names its constraint, so it can be argued with.",
        "Components are named as they are in the code, not as they are sold.",
      ],
      componentsTitle: "what one layout declares",
      components: [
        "fields, labels, defaults",
        "a preview component",
        "an HTML renderer",
        "a DrawingML renderer",
      ],
      note: "The dark slide is the one place a technical reader slows down.",
    }),
    slideWithContent("table", {
      eyebrow: "LAYOUT 07 · TABLE",
      heading: "Table: a grid for things that must line up.",
      rowHeader: "Layout",
      columns: ["Use it when", "Avoid it when"],
      rows: [
        {
          label: "Cards",
          detail: "parallel points",
          cells: ["3–4 comparable items", "the items need different weights"],
        },
        {
          label: "Table",
          detail: "comparison grid",
          cells: ["3–10 labelled rows", "there are more than three columns"],
        },
        {
          label: "Diagram",
          detail: "shapes and arrows",
          cells: ["one flow, six boxes at most", "the flow needs prose to explain"],
        },
      ],
      note: "Column headers carry the comparison; the first column names what is compared.",
    }),
    slideWithContent("diagram", {
      eyebrow: "LAYOUT 08 · DIAGRAM",
      heading: "Diagram: boxes you drag, arrows you draw.",
      routing: "straight",
      boxes: [
        { id: "tour-schema", shape: "box", tone: "accent", label: "Schema", x: 40, y: 170 },
        { id: "tour-fields", shape: "ellipse", tone: "emphasis", label: "Fields", x: 300, y: 158 },
        { id: "tour-draft", shape: "diamond", tone: "accent", label: "Draft", x: 560, y: 168 },
        { id: "tour-export", shape: "cylinder", tone: "muted", label: "Exports", x: 800, y: 168 },
      ],
      links: [
        { from: "tour-schema", to: "tour-fields" },
        { from: "tour-fields", to: "tour-draft" },
        { from: "tour-draft", to: "tour-export" },
      ],
      note: "Drag a box to move it, double-click a label to rename it, drag from a dot to link two boxes.",
    }),
    slideWithContent("closing", {
      eyebrow: "LAYOUT 09 · CLOSING",
      heading: "Pick a layout, then write the deck.",
      lede: "Every slide here is a form the inspector can fill. This tour stays in the library while you start another deck.",
      meta: [
        { label: "To remember", value: "Nine layouts, one file." },
        { label: "To do", value: "New deck → pick a layout → export." },
      ],
    }),
  ];

  return createDeck({
    title: "Deck Studio layout tour",
    footerLabel: "Deck Studio · layout tour",
    accentColor: DEFAULT_ACCENT_COLOR,
    slides,
  });
}

/** A new deck always starts from a single title slide. */
export function createNewDeck(title = "Untitled deck"): Deck {
  return createDeck({
    title,
    footerLabel: title,
    accentColor: DEFAULT_ACCENT_COLOR,
    slides: [createBlankSlide("title")],
  });
}
