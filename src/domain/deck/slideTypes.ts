export type SlideLayoutId = "title" | "cards" | "flow" | "rules" | "statement" | "technical" | "closing";

export interface MetaRow {
  label: string;
  value: string;
}

export interface CardItem {
  marker: string;
  title: string;
  body: string;
}

export interface FlowNode {
  title: string;
  detail: string;
}

export interface FlowLane {
  label: string;
  nodes: FlowNode[];
}

export interface RuleItem {
  marker: string;
  statement: string;
}

export interface TitleSlideContent {
  eyebrow: string;
  heading: string;
  lede: string;
  pills: string[];
  meta: MetaRow[];
}

export interface CardsSlideContent {
  eyebrow: string;
  heading: string;
  cards: CardItem[];
  note: string;
}

export interface FlowSlideContent {
  eyebrow: string;
  heading: string;
  lanes: FlowLane[];
  note: string;
}

export interface RulesSlideContent {
  eyebrow: string;
  heading: string;
  rules: RuleItem[];
  note: string;
}

export interface StatementSlideContent {
  eyebrow: string;
  heading: string;
  points: string[];
  figure: string;
  figureCaption: string;
}

export interface TechnicalSlideContent {
  eyebrow: string;
  heading: string;
  points: string[];
  componentsTitle: string;
  components: string[];
  note: string;
}

export interface ClosingSlideContent {
  eyebrow: string;
  heading: string;
  lede: string;
  meta: MetaRow[];
}

/** The content shape each layout owns, keyed by layout id. */
export interface SlideContentByLayout {
  title: TitleSlideContent;
  cards: CardsSlideContent;
  flow: FlowSlideContent;
  rules: RulesSlideContent;
  statement: StatementSlideContent;
  technical: TechnicalSlideContent;
  closing: ClosingSlideContent;
}

/** A slide is discriminated by its layout, so the content type follows it. */
export type Slide = {
  [Layout in SlideLayoutId]: {
    id: string;
    layout: Layout;
    content: SlideContentByLayout[Layout];
  };
}[SlideLayoutId];

export type SlideOf<Layout extends SlideLayoutId> = Extract<Slide, { layout: Layout }>;

export type SlideContent = Slide["content"];

export interface DeckTheme {
  accentColor: string;
}

export interface Deck {
  id: string;
  title: string;
  footerLabel: string;
  theme: DeckTheme;
  slides: Slide[];
  updatedAt: string;
}

/** A path through slide content: object keys and list indexes. */
export type ContentPath = ReadonlyArray<string | number>;
