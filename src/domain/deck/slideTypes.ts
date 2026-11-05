export type SlideLayoutId =
  | "title"
  | "cards"
  | "flow"
  | "rules"
  | "statement"
  | "technical"
  | "table"
  | "diagram"
  | "closing";

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

export interface TableRow {
  label: string;
  detail: string;
  cells: string[];
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

export interface TableSlideContent {
  eyebrow: string;
  heading: string;
  rowHeader: string;
  columns: string[];
  rows: TableRow[];
  note: string;
}

export type DiagramShape = "box" | "ellipse" | "diamond" | "cylinder";

/** Colour treatment of one box, independent of the deck accent. */
export type DiagramTone = "accent" | "emphasis" | "ink" | "muted" | "warm";

export interface DiagramBox {
  /** Stable across reordering and dragging; links point at it. */
  id: string;
  shape: DiagramShape;
  tone: DiagramTone;
  label: string;
  /** Top-left corner of the shape's box, in the drawing's own 1000×440 units. */
  x: number;
  y: number;
}

export interface DiagramLink {
  /** Ids of the two boxes the arrow joins. */
  from: string;
  to: string;
}

/** How the arrows in one diagram are drawn between their anchors. */
export type DiagramRouting = "straight" | "elbow";

export interface DiagramSlideContent {
  eyebrow: string;
  heading: string;
  /** Straight segments, or right angles like draw.io's orthogonal links. */
  routing: DiagramRouting;
  boxes: DiagramBox[];
  /** Arrows are a list of links, so any two boxes can be joined. */
  links: DiagramLink[];
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
  table: TableSlideContent;
  diagram: DiagramSlideContent;
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
