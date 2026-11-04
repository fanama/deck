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
 * The deck the studio opens with. It is a working example of every layout a
 * first-time author should see, written about the product itself.
 */
export function createStarterDeck(): Deck {
  const slides: Slide[] = [
    slideWithContent("title", {
      eyebrow: "DECK STUDIO · STARTER DECK",
      heading: "A deck you can edit, export, and present offline.",
      lede: "Seven structured layouts, one stylesheet, zero dependencies. Everything you see here exports to a single HTML file.",
      pills: ["1280 × 720 stage", "Print-ready", "No CDN"],
      meta: [
        { label: "For whom", value: "Teams that present from a browser" },
        { label: "What you get", value: "One self-contained .html file" },
        { label: "What runs", value: "Static HTML, opened from disk" },
      ],
    }),
    slideWithContent("cards", {
      eyebrow: "THE PROBLEM",
      heading: "A presentation decays when the tool owns the format.",
      cards: [
        {
          marker: "01",
          title: "Locked formats",
          body: "The slides live inside an application that decides what you are allowed to change.",
        },
        {
          marker: "02",
          title: "Broken imports",
          body: "A missing font or a moved image turns the deck you rehearsed into a different deck.",
        },
        {
          marker: "03",
          title: "Export drift",
          body: "The file you sent is not the file you presented, because two exporters disagree.",
        },
      ],
      note: "One HTML file, opened from disk, is the smallest format that survives all three.",
    }),
    slideWithContent("flow", {
      eyebrow: "HOW IT WORKS",
      heading: "Author in the studio, present from the file.",
      lanes: [
        {
          label: "Authoring",
          nodes: [
            { title: "Pick a layout", detail: "7 structured layouts" },
            { title: "Fill the fields", detail: "no freeform canvas" },
            { title: "Read the warnings", detail: "length and wording rules" },
            { title: "Export HTML", detail: "one document" },
          ],
        },
        {
          label: "Presenting",
          nodes: [
            { title: "Open the file", detail: "file:// works" },
            { title: "Arrow keys", detail: "the hash keeps your place" },
            { title: "Print to PDF", detail: "one slide per page" },
            { title: "Share", detail: "no account needed" },
          ],
        },
      ],
      note: "The exported deck carries its own styles, its own navigation and its own print rules.",
    }),
    slideWithContent("technical", {
      eyebrow: "UNDER THE HOOD",
      heading: "What the exporter actually writes.",
      points: [
        "One style block, copied from the same stylesheet the preview uses.",
        "Sections rendered from the same layout content the inspector edits.",
        "No build step, no network request, no font download.",
      ],
      componentsTitle: "what ends up in the file",
      components: [
        "deck.css · tokens and slide shell",
        "renderSlideHtml · one function per layout",
        "escapeHtml · every field, every time",
        "replaceState · guarded for file://",
      ],
      note: "Open the file with no server and the deck still navigates.",
    }),
    slideWithContent("closing", {
      eyebrow: "QUESTIONS",
      heading: "What decision do you need from the room?",
      lede: "Close on a question or a decision, not on a thank you.",
      meta: [
        { label: "To remember", value: "One file, no dependencies." },
        { label: "To decide", value: "Own the deck format, or keep renting it." },
      ],
    }),
  ];

  return createDeck({
    title: "Deck Studio starter deck",
    footerLabel: "Deck Studio · starter deck",
    accentColor: DEFAULT_ACCENT_COLOR,
    slides,
  });
}

/** A new deck always starts from a single title slide. */
export function createNewDeck(): Deck {
  return createDeck({
    title: "Untitled deck",
    footerLabel: "Untitled deck",
    accentColor: DEFAULT_ACCENT_COLOR,
    slides: [createBlankSlide("title")],
  });
}
