import type {
  ContentPath,
  SlideContentByLayout,
  SlideLayoutId,
} from "./slideTypes.ts";

/**
 * The catalogue of slide layouts. Each layout describes what a slide holds
 * (its content schema), how the inspector edits it, and which shell it
 * renders in. The editor, the preview and the HTML exporter all read this
 * description, so a new layout is added in exactly one place.
 */

export interface BaseFieldDefinition {
  key: string;
  label: string;
  maxLength: number;
}

export interface TextFieldDefinition extends BaseFieldDefinition {
  type: "text";
  defaultValue: string;
}

export interface TextareaFieldDefinition extends BaseFieldDefinition {
  type: "textarea";
  defaultValue: string;
}

export type ListItemValue = string | Record<string, unknown>;

export interface ListFieldDefinition extends BaseFieldDefinition {
  type: "list";
  itemLabel: string;
  maxItems: number;
  defaultItems: ListItemValue[];
  itemFields?: FieldDefinition[];
  createEmptyItem?: () => ListItemValue;
}

export type FieldDefinition = TextFieldDefinition | TextareaFieldDefinition | ListFieldDefinition;

export interface SlideLayoutDefinition {
  id: SlideLayoutId;
  label: string;
  purpose: string;
  shellClass: string;
  fields: FieldDefinition[];
}

type TextFieldOptions = Partial<Pick<TextFieldDefinition, "maxLength" | "defaultValue">>;
type TextListOptions = Partial<
  Pick<ListFieldDefinition, "itemLabel" | "maxItems" | "defaultItems" | "createEmptyItem">
>;
type GroupListOptions = Partial<
  Pick<ListFieldDefinition, "itemLabel" | "maxItems" | "defaultItems" | "itemFields">
>;

function textField(key: string, label: string, options: TextFieldOptions = {}): TextFieldDefinition {
  return { key, label, type: "text", maxLength: 120, defaultValue: "", ...options };
}

function longTextField(key: string, label: string, options: TextFieldOptions = {}): TextareaFieldDefinition {
  return { key, label, type: "textarea", maxLength: 260, defaultValue: "", ...options };
}

function textListField(key: string, label: string, options: TextListOptions = {}): ListFieldDefinition {
  return {
    key,
    label,
    type: "list",
    maxLength: 120,
    itemLabel: "Item",
    maxItems: 6,
    defaultItems: [],
    createEmptyItem: () => "",
    ...options,
  };
}

function groupListField(key: string, label: string, options: GroupListOptions = {}): ListFieldDefinition {
  return {
    key,
    label,
    type: "list",
    maxLength: 120,
    itemLabel: "Item",
    maxItems: 6,
    itemFields: [],
    defaultItems: [],
    ...options,
  };
}

export const SLIDE_LAYOUTS: SlideLayoutDefinition[] = [
  {
    id: "title",
    label: "Title",
    purpose: "Opens the deck: the promise, who it is for, what it proves.",
    shellClass: "slide title",
    fields: [
      textField("eyebrow", "Eyebrow", { defaultValue: "SECTION · CONTEXT", maxLength: 80 }),
      textField("heading", "Heading", { defaultValue: "The promise, in one sentence.", maxLength: 100 }),
      longTextField("lede", "Lede", {
        defaultValue: "What it does for whom, in the audience's words.",
        maxLength: 220,
      }),
      textListField("pills", "Proof pills", {
        itemLabel: "Pill",
        maxItems: 4,
        defaultItems: ["Proof point", "Date / venue"],
      }),
      groupListField("meta", "Meta rows", {
        itemLabel: "Row",
        maxItems: 3,
        defaultItems: [
          { label: "For whom", value: "One line" },
          { label: "What you get", value: "One line" },
          { label: "What runs", value: "One line" },
        ],
        itemFields: [textField("label", "Label", { maxLength: 40 }), textField("value", "Value", { maxLength: 80 })],
      }),
    ],
  },
  {
    id: "cards",
    label: "Cards",
    purpose: "Two to four pains, consequences or options, side by side.",
    shellClass: "slide",
    fields: [
      textField("eyebrow", "Eyebrow", { defaultValue: "THE PROBLEM", maxLength: 80 }),
      textField("heading", "Heading", { defaultValue: "One idea, stated as a claim.", maxLength: 100 }),
      groupListField("cards", "Cards", {
        itemLabel: "Card",
        maxItems: 4,
        defaultItems: [
          { marker: "01", title: "Cause", body: "What is wrong today, in concrete terms." },
          { marker: "02", title: "Consequence", body: "What it costs the audience: time, money, risk, trust." },
          { marker: "03", title: "Twist", body: "The part that is not obvious, and why the obvious fix fails." },
        ],
        itemFields: [
          textField("marker", "Marker", { maxLength: 4 }),
          textField("title", "Title", { maxLength: 60 }),
          longTextField("body", "Body", { maxLength: 220 }),
        ],
      }),
      longTextField("note", "Footnote", { maxLength: 160 }),
    ],
  },
  {
    id: "flow",
    label: "Flow",
    purpose: "One diagram: two lanes, each a short row of steps.",
    shellClass: "slide",
    fields: [
      textField("eyebrow", "Eyebrow", { defaultValue: "HOW IT WORKS", maxLength: 80 }),
      textField("heading", "Heading", { defaultValue: "One diagram, two lanes.", maxLength: 100 }),
      groupListField("lanes", "Lanes", {
        itemLabel: "Lane",
        maxItems: 3,
        defaultItems: [
          {
            label: "Input",
            nodes: [
              { title: "Step", detail: "detail" },
              { title: "Step", detail: "detail" },
              { title: "Step", detail: "detail" },
            ],
          },
          {
            label: "Request",
            nodes: [
              { title: "Step", detail: "detail" },
              { title: "Step", detail: "detail" },
              { title: "Answer", detail: "detail" },
            ],
          },
        ],
        itemFields: [
          textField("label", "Lane label", { maxLength: 40 }),
          {
            key: "nodes",
            label: "Nodes",
            type: "list",
            maxLength: 60,
            itemLabel: "Node",
            maxItems: 5,
            defaultItems: [{ title: "Step", detail: "detail" }],
            itemFields: [
              textField("title", "Title", { maxLength: 40 }),
              textField("detail", "Detail", { maxLength: 60 }),
            ],
            createEmptyItem: () => ({ title: "Step", detail: "detail" }),
          },
        ],
      }),
      longTextField("note", "Footnote", { maxLength: 160 }),
    ],
  },
  {
    id: "rules",
    label: "Rules",
    purpose: "A short list of guardrails, each tied to the failure it prevents.",
    shellClass: "slide",
    fields: [
      textField("eyebrow", "Eyebrow", { defaultValue: "GUARDRAILS", maxLength: 80 }),
      textField("heading", "Heading", { defaultValue: "Each rule earns its place.", maxLength: 100 }),
      groupListField("rules", "Rules", {
        itemLabel: "Rule",
        maxItems: 5,
        defaultItems: [
          { marker: "1", statement: "Rule in bold. The explanation follows in one sentence." },
          { marker: "2", statement: "Rule. It is short enough to read while someone is talking." },
        ],
        itemFields: [
          textField("marker", "Marker", { maxLength: 3 }),
          longTextField("statement", "Statement", { maxLength: 220 }),
        ],
      }),
      longTextField("note", "Footnote", { maxLength: 160 }),
    ],
  },
  {
    id: "statement",
    label: "Statement",
    purpose: "Three points beside one figure that carries its own context.",
    shellClass: "slide",
    fields: [
      textField("eyebrow", "Eyebrow", { defaultValue: "CONTEXT", maxLength: 80 }),
      textField("heading", "Heading", { defaultValue: "A claim, and the number behind it.", maxLength: 100 }),
      textListField("points", "Points", {
        itemLabel: "Point",
        maxItems: 5,
        defaultItems: [
          "A point stated as a claim, not an adjective.",
          "Each point fits on one line.",
          "The last point earns the figure beside it.",
        ],
      }),
      textField("figure", "Figure", { defaultValue: "42", maxLength: 8 }),
      longTextField("figureCaption", "Figure caption", {
        defaultValue: "Figures carry their context: machine, corpus, conditions.",
        maxLength: 160,
      }),
    ],
  },
  {
    id: "technical",
    label: "Technical",
    purpose: "The dark slide: one mechanism a technical reader will test.",
    shellClass: "slide dark",
    fields: [
      textField("eyebrow", "Eyebrow", { defaultValue: "UNDER THE HOOD", maxLength: 80 }),
      textField("heading", "Heading", { defaultValue: "The claim a technical reader will test.", maxLength: 100 }),
      textListField("points", "Points", {
        itemLabel: "Point",
        maxItems: 5,
        defaultItems: ["Mechanism, named precisely.", "The constraint that forced it."],
      }),
      textField("componentsTitle", "Components title", {
        defaultValue: "the · list · of · components",
        maxLength: 60,
      }),
      textListField("components", "Components", {
        itemLabel: "Component",
        maxItems: 8,
        defaultItems: ["one module", "one adapter"],
      }),
      longTextField("note", "Footline", {
        maxLength: 160,
        defaultValue: "One line on what this buys operationally.",
      }),
    ],
  },
  {
    id: "closing",
    label: "Closing",
    purpose: "Ends on a decision or a question, never a thank you.",
    shellClass: "slide title",
    fields: [
      textField("eyebrow", "Eyebrow", { defaultValue: "QUESTIONS", maxLength: 80 }),
      textField("heading", "Heading", { defaultValue: "Close on a question or a decision.", maxLength: 100 }),
      longTextField("lede", "Lede", {
        defaultValue: "What you need from the room, in one line.",
        maxLength: 200,
      }),
      groupListField("meta", "Meta rows", {
        itemLabel: "Row",
        maxItems: 3,
        defaultItems: [
          { label: "To remember", value: "One sentence." },
          { label: "To decide", value: "One sentence." },
        ],
        itemFields: [textField("label", "Label", { maxLength: 40 }), textField("value", "Value", { maxLength: 80 })],
      }),
    ],
  },
];

export function findSlideLayout<Layout extends SlideLayoutId>(
  layoutId: Layout,
): SlideLayoutDefinition & { id: Layout } {
  const layout = SLIDE_LAYOUTS.find((candidate) => candidate.id === layoutId);
  if (!layout) throw new Error(`Unknown slide layout: ${layoutId}`);
  return layout as SlideLayoutDefinition & { id: Layout };
}

export function isKnownSlideLayout(layoutId: unknown): layoutId is SlideLayoutId {
  return SLIDE_LAYOUTS.some((candidate) => candidate.id === layoutId);
}

export function slideShellClassForLayout(layoutId: SlideLayoutId): string {
  return isKnownSlideLayout(layoutId) ? findSlideLayout(layoutId).shellClass : "slide";
}

/** Builds the value of one list item, falling back to the field defaults. */
function createListItemValue(field: ListFieldDefinition, item?: unknown): ListItemValue {
  if (!field.itemFields) return typeof item === "string" ? item : "";

  const overrides =
    typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};

  return { ...createValuesForFields(field.itemFields), ...overrides };
}

function createValuesForFields(fields: FieldDefinition[]): Record<string, unknown> {
  const values: Record<string, unknown> = {};

  for (const field of fields) {
    values[field.key] =
      field.type === "list"
        ? field.defaultItems.map((item) => createListItemValue(field, item))
        : field.defaultValue;
  }

  return values;
}

/** The content a brand new slide of this layout starts with. */
export function createDefaultContentForLayout<Layout extends SlideLayoutId>(
  layoutId: Layout,
): SlideContentByLayout[Layout] {
  return createValuesForFields(findSlideLayout(layoutId).fields) as unknown as SlideContentByLayout[Layout];
}

function findFieldAtPath(layout: SlideLayoutDefinition, path: ContentPath): FieldDefinition | null {
  let fields = layout.fields;
  let currentField: FieldDefinition | null = null;

  for (const segment of path) {
    if (typeof segment === "number") continue;
    currentField = fields.find((candidate) => candidate.key === segment) ?? null;
    if (!currentField) return null;
    fields = currentField.type === "list" ? (currentField.itemFields ?? []) : [];
  }

  return currentField;
}

/** Creates the item "Add" appends to a list field, at any nesting depth. */
export function createEmptyListItem(layoutId: SlideLayoutId, listFieldPath: ContentPath): ListItemValue {
  const field = findFieldAtPath(findSlideLayout(layoutId), listFieldPath);
  if (!field) return "";
  if (field.type !== "list") return "";
  if (field.itemFields) return createValuesForFields(field.itemFields) as ListItemValue;
  return field.createEmptyItem ? field.createEmptyItem() : "";
}
