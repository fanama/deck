import type {
  DiagramBox,
  DiagramLink,
  DiagramRouting,
  DiagramShape,
  DiagramTone,
} from "../domain/deck/slideTypes.ts";
import { escapeHtml } from "./escapeHtml.ts";

/**
 * The diagram is generated, never authored as markup: boxes carry a stable id,
 * a shape, a position and a size; links point at those ids. One builder serves
 * the HTML export and the PPTX rasteriser; the preview draws the same geometry
 * with Svelte so it can be dragged and resized.
 */

export const DIAGRAM_WIDTH = 1000;
export const DIAGRAM_HEIGHT = 440;
export const DIAGRAM_LABEL_LINE_HEIGHT = 19;

/** A schema node: a title band, then one row per field. */
export const SCHEMA_HEADER_HEIGHT = 30;
export const SCHEMA_FIELD_ROW_HEIGHT = 24;
export const SCHEMA_FIELD_PADDING_Y = 4;
export const SCHEMA_FIELD_MAX = 8;
export const SCHEMA_FIELD_MAX_LENGTH = 24;

const SCHEMA_MIN_WIDTH = 160;
const SCHEMA_MAX_MIN_WIDTH = 380;
const SCHEMA_PADDING_X = 10;
const SCHEMA_TITLE_CHAR_WIDTH = 7.2;
const SCHEMA_FIELD_CHAR_WIDTH = 6.6;
const SCHEMA_TITLE_FONT = "Arial, Helvetica, sans-serif";
const SCHEMA_FIELD_FONT = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

export const DIAGRAM_SHAPES: DiagramShape[] = ["box", "ellipse", "diamond", "cylinder"];

export const DIAGRAM_SHAPE_LABELS: Record<DiagramShape, string> = {
  box: "Box",
  ellipse: "Circle",
  diamond: "Diamond",
  cylinder: "Cylinder",
};

export const DIAGRAM_TONES: DiagramTone[] = ["accent", "emphasis", "ink", "muted", "warm"];

export const DIAGRAM_TONE_LABELS: Record<DiagramTone, string> = {
  accent: "Accent",
  emphasis: "Emphasis",
  ink: "Ink",
  muted: "Muted",
  warm: "Warm",
};

export const DIAGRAM_ROUTINGS: DiagramRouting[] = ["straight", "elbow"];

export const DIAGRAM_ROUTING_LABELS: Record<DiagramRouting, string> = {
  straight: "Straight",
  elbow: "90° elbow",
};

export function isDiagramRouting(value: unknown): value is DiagramRouting {
  return typeof value === "string" && DIAGRAM_ROUTINGS.includes(value as DiagramRouting);
}

/** Older diagrams, and anything unknown, draw straight arrows. */
export function normalizeDiagramRouting(value: unknown): DiagramRouting {
  return isDiagramRouting(value) ? value : "straight";
}

export interface ShapeSize {
  width: number;
  height: number;
}

/** A circle has to be square, a diamond reads better wider than tall. */
const SHAPE_SIZES: Record<DiagramShape, ShapeSize> = {
  box: { width: 200, height: 84 },
  ellipse: { width: 120, height: 120 },
  diamond: { width: 190, height: 104 },
  cylinder: { width: 170, height: 104 },
};

/** The share of the width a label may use before it hits the outline. */
const SHAPE_TEXT_SHARE: Record<DiagramShape, number> = {
  box: 0.92,
  ellipse: 0.74,
  diamond: 0.52,
  cylinder: 0.82,
};

/** Average advance of the 16px serif label, in drawing units. */
const LABEL_CHAR_WIDTH = 7.6;

const LABEL_MAX_LINES = 3;
const ARROW_HEAD_LENGTH = 13;
const ARROW_HEAD_HALF_WIDTH = 6;

export interface DiagramColors {
  accent: string;
  ink: string;
  muted: string;
  warm: string;
  paper: string;
  /** Readable text on an accent-filled shape, independent of the paper. */
  onAccent: string;
}

/** Used when nothing supplies a deck accent; matches the studio default. */
export const DIAGRAM_COLORS: DiagramColors = {
  accent: "#0f6b64",
  ink: "#12171f",
  muted: "#667485",
  warm: "#b45309",
  paper: "#ffffff",
  onAccent: "#ffffff",
};

export interface DiagramBoxStyle {
  stroke: string;
  fill: string;
  text: string;
}

/** Outline, fill and label colour for one box's tone. */
export function diagramBoxStyle(colors: DiagramColors, tone: DiagramTone | undefined): DiagramBoxStyle {
  switch (tone) {
    case "emphasis":
      return { stroke: colors.accent, fill: colors.accent, text: colors.onAccent };
    case "ink":
      return { stroke: colors.ink, fill: colors.paper, text: colors.ink };
    case "muted":
      return { stroke: colors.muted, fill: colors.paper, text: colors.muted };
    case "warm":
      return { stroke: colors.warm, fill: colors.paper, text: colors.warm };
    default:
      return { stroke: colors.accent, fill: colors.paper, text: colors.ink };
  }
}

export function isDiagramTone(value: unknown): value is DiagramTone {
  return typeof value === "string" && DIAGRAM_TONES.includes(value as DiagramTone);
}

export interface DiagramArrow {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  /** Shaft vertices, already formatted for an SVG polyline. */
  points: string;
  /** Three points of the arrowhead, already formatted for an SVG polygon. */
  headPoints: string;
}

export type DiagramAnchorSide = "top" | "right" | "bottom" | "left";

/** Read in this order so exact ties resolve the same way every time. */
export const DIAGRAM_ANCHOR_SIDES: DiagramAnchorSide[] = ["top", "right", "bottom", "left"];

export interface DiagramAnchorPoint {
  x: number;
  y: number;
}

/**
 * Midpoint of one side of the shape's bounding box. It sits on the outline of
 * every shape the catalogue has: the ellipse's axis, the diamond's four
 * vertices, the cylinder's caps. An arrow can leave from any side, with no gap.
 */
export function diagramAnchor(box: DiagramBox, side: DiagramAnchorSide): DiagramAnchorPoint {
  const { width, height } = diagramShapeSize(box);
  const centreX = box.x + width / 2;
  const centreY = box.y + height / 2;

  switch (side) {
    case "top":
      return { x: centreX, y: box.y };
    case "bottom":
      return { x: centreX, y: box.y + height };
    case "left":
      return { x: box.x, y: centreY };
    default:
      return { x: box.x + width, y: centreY };
  }
}

export interface DiagramLinkSides {
  from: DiagramAnchorSide;
  to: DiagramAnchorSide;
}

/**
 * The closest pair of anchors, which is what draw.io picks for a floating
 * connection when the line is straight: boxes side by side join right to left,
 * stacked boxes join bottom to top, and either direction works in reverse.
 */
export function diagramLinkSides(from: DiagramBox, to: DiagramBox): DiagramLinkSides {
  let best: DiagramLinkSides = { from: "right", to: "left" };
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const fromSide of DIAGRAM_ANCHOR_SIDES) {
    const fromPoint = diagramAnchor(from, fromSide);

    for (const toSide of DIAGRAM_ANCHOR_SIDES) {
      const toPoint = diagramAnchor(to, toSide);
      const distance = (toPoint.x - fromPoint.x) ** 2 + (toPoint.y - fromPoint.y) ** 2;

      if (distance < bestDistance) {
        bestDistance = distance;
        best = { from: fromSide, to: toSide };
      }
    }
  }

  return best;
}

let diagramBoxCounter = 0;

/** Ids survive reordering and dragging; links reference them. */
export function createDiagramBoxId(): string {
  const unique =
    globalThis.crypto?.randomUUID?.() ?? `local-${Date.now().toString(36)}-${diagramBoxCounter++}`;

  return `box_${unique}`;
}

/** Id shared by boxes that travel together as one group. */
export function createDiagramGroupId(): string {
  const unique =
    globalThis.crypto?.randomUUID?.() ?? `local-${Date.now().toString(36)}-${diagramBoxCounter++}`;

  return `group_${unique}`;
}

export function isDiagramShape(value: unknown): value is DiagramShape {
  return typeof value === "string" && DIAGRAM_SHAPES.includes(value as DiagramShape);
}

function positiveNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/** The size a shape starts with, before anyone resizes it. */
export function diagramDefaultSize(shape: DiagramShape | undefined): ShapeSize {
  return SHAPE_SIZES[isDiagramShape(shape) ? shape : "box"];
}

/**
 * A box's own size, falling back to its shape's default. Passing a shape is
 * still supported for catalogue defaults; drawing code passes the box.
 */
export function diagramShapeSize(value: DiagramBox | DiagramShape | undefined): ShapeSize {
  if (value && typeof value === "object") {
    const fallback = diagramDefaultSize(value.shape);

    return {
      width: positiveNumber(value.width) ?? fallback.width,
      height: positiveNumber(value.height) ?? fallback.height,
    };
  }

  return diagramDefaultSize(value);
}

/** Trimmed, capped field names; anything else becomes an empty schema node. */
export function normalizeDiagramFields(fields: string[] | undefined): string[] {
  return (Array.isArray(fields) ? fields : [])
    .filter((field): field is string => typeof field === "string")
    .map((field) => field.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, SCHEMA_FIELD_MAX)
    .map((field) => field.slice(0, SCHEMA_FIELD_MAX_LENGTH));
}

function schemaNodeHeight(fieldCount: number): number {
  return (
    SCHEMA_HEADER_HEIGHT +
    Math.max(1, fieldCount) * SCHEMA_FIELD_ROW_HEIGHT +
    SCHEMA_FIELD_PADDING_Y * 2
  );
}

/**
 * The smallest size a node can have without clipping its content. Plain boxes
 * keep their shape's default size as the minimum.
 */
export function diagramBoxMinSize(box: DiagramBox): ShapeSize {
  const fields = normalizeDiagramFields(box.fields);
  if (fields.length === 0) return diagramDefaultSize(box.shape);

  const titleWidth = box.label.trim().length * SCHEMA_TITLE_CHAR_WIDTH + SCHEMA_PADDING_X * 2 + 12;
  const fieldWidth = Math.max(
    ...fields.map((field) => field.length * SCHEMA_FIELD_CHAR_WIDTH + SCHEMA_PADDING_X * 2),
    0,
  );

  return {
    width: Math.min(
      SCHEMA_MAX_MIN_WIDTH,
      Math.max(SCHEMA_MIN_WIDTH, Math.ceil(Math.max(titleWidth, fieldWidth))),
    ),
    height: schemaNodeHeight(fields.length),
  };
}

function clamp(value: number, max: number): number {
  return Math.min(Math.max(value, 0), max);
}

function coordinate(value: number, max: number, fallback: number): number {
  return Number.isFinite(value) ? clamp(value, max) : fallback;
}

/** A box added in the inspector lands on a grid instead of on top of another. */
function fallbackX(index: number): number {
  return 40 + (index % 3) * 360;
}

function fallbackY(index: number): number {
  return 90 + Math.floor(index / 3) * 120;
}

/**
 * Clamps stored positions and sizes to the drawing and fills in what older
 * decks do not have: ids (links need them), shapes, sizes and field rows.
 */
export function normalizeDiagramBoxes(boxes: DiagramBox[]): DiagramBox[] {
  const normalized = boxes.map((box, index) => {
    const shape = isDiagramShape(box.shape) ? box.shape : "box";
    const label = typeof box.label === "string" ? box.label : "";
    // Kept verbatim while editing: trimming here would eat the space between
    // two words as it is typed. The renderers normalise their own copy.
    const fields = Array.isArray(box.fields)
      ? box.fields.filter((field): field is string => typeof field === "string")
      : [];
    const minSize = diagramBoxMinSize({ ...box, shape, label, fields });
    const defaultSize = diagramDefaultSize(shape);
    const width = Math.max(positiveNumber(box.width) ?? defaultSize.width, minSize.width);
    const height = Math.max(positiveNumber(box.height) ?? defaultSize.height, minSize.height);
    const x = coordinate(box.x, DIAGRAM_WIDTH - minSize.width, fallbackX(index));
    const y = coordinate(box.y, DIAGRAM_HEIGHT - minSize.height, fallbackY(index));

    return {
      id: typeof box.id === "string" && box.id.trim() ? box.id : `box-${index + 1}`,
      shape,
      tone: isDiagramTone(box.tone) ? box.tone : "accent",
      label,
      x,
      y,
      width: Math.min(width, DIAGRAM_WIDTH - x),
      height: Math.min(height, DIAGRAM_HEIGHT - y),
      fields,
      parentId:
        typeof box.parentId === "string" && box.parentId.trim() ? box.parentId : undefined,
      groupId: typeof box.groupId === "string" && box.groupId.trim() ? box.groupId : undefined,
    };
  });

  // A parent must exist and must not sit inside its own descendant.
  const byId = new Map(normalized.map((box) => [box.id, box]));

  for (const box of normalized) {
    if (!box.parentId) continue;

    const seen = new Set<string>([box.id]);
    let cursor = byId.get(box.parentId);

    if (!cursor) {
      box.parentId = undefined;
      continue;
    }

    while (cursor) {
      if (seen.has(cursor.id)) {
        box.parentId = undefined;
        break;
      }

      seen.add(cursor.id);
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
    }
  }

  return normalized;
}

/** Drops links whose boxes are gone, duplicates and self-links. */
export function normalizeDiagramLinks(
  links: DiagramLink[] | undefined,
  boxes: DiagramBox[],
): DiagramLink[] {
  const ids = new Set(boxes.map((box) => box.id));
  const seen = new Set<string>();

  return (links ?? []).filter((link) => {
    if (!link || typeof link.from !== "string" || typeof link.to !== "string") return false;
    if (link.from === link.to || !ids.has(link.from) || !ids.has(link.to)) return false;

    const key = `${link.from}->${link.to}`;
    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

/** Parents before children, so a nested box paints on top of its container. */
export function diagramRenderOrder(boxes: DiagramBox[]): DiagramBox[] {
  const byId = new Map(boxes.map((box) => [box.id, box]));

  const depthOf = (box: DiagramBox): number => {
    const seen = new Set<string>();
    let cursor: DiagramBox | undefined = box;
    let depth = 0;

    while (cursor?.parentId) {
      if (seen.has(cursor.id)) break;
      seen.add(cursor.id);
      cursor = byId.get(cursor.parentId);
      depth += 1;
    }

    return depth;
  };

  return boxes
    .map((box, index) => ({ box, index, depth: depthOf(box) }))
    .sort((a, b) => a.depth - b.depth || a.index - b.index)
    .map((entry) => entry.box);
}

/** Ids of boxes that contain at least one other box. */
export function diagramContainerIds(boxes: DiagramBox[]): Set<string> {
  return new Set(
    boxes
      .map((box) => box.parentId)
      .filter((id): id is string => typeof id === "string" && id.length > 0),
  );
}

/**
 * Every box that should move with a selection: the seeds, boxes in the same
 * groups, and the descendants of all of them.
 */
export function diagramMoveIds(boxes: DiagramBox[], seedIds: Iterable<string>): Set<string> {
  const ids = new Set(seedIds);
  const groupIds = new Set(
    boxes
      .filter((box) => ids.has(box.id) && box.groupId)
      .map((box) => box.groupId as string),
  );

  for (const box of boxes) {
    if (box.groupId && groupIds.has(box.groupId)) ids.add(box.id);
  }

  const children = new Map<string, DiagramBox[]>();

  for (const box of boxes) {
    if (!box.parentId) continue;
    const siblings = children.get(box.parentId) ?? [];
    siblings.push(box);
    children.set(box.parentId, siblings);
  }

  const addDescendants = (id: string): void => {
    for (const child of children.get(id) ?? []) {
      if (ids.has(child.id)) continue;
      ids.add(child.id);
      addDescendants(child.id);
    }
  };

  for (const id of [...ids]) addDescendants(id);

  return ids;
}

/** Topmost box under the point; children sit over their containers. */
export function diagramBoxAtPoint(
  boxes: DiagramBox[],
  x: number,
  y: number,
  excludeIds?: ReadonlySet<string>,
): DiagramBox | undefined {
  const ordered = diagramRenderOrder(boxes);

  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    const box = ordered[index];
    if (!box || excludeIds?.has(box.id)) continue;

    const size = diagramShapeSize(box);
    if (x >= box.x && x <= box.x + size.width && y >= box.y && y <= box.y + size.height) {
      return box;
    }
  }

  return undefined;
}

/** The outline of one shape, as an SVG `d` attribute. */
export function diagramShapePath(box: DiagramBox): string {
  const { width: w, height: h } = diagramShapeSize(box);
  const { x, y } = box;

  if (box.shape === "ellipse") {
    const rx = w / 2;
    const ry = h / 2;
    const cy = y + ry;

    return (
      `M ${x} ${cy} A ${rx} ${ry} 0 1 0 ${x + w} ${cy} ` +
      `A ${rx} ${ry} 0 1 0 ${x} ${cy} Z`
    );
  }

  if (box.shape === "diamond") {
    return (
      `M ${x + w / 2} ${y} L ${x + w} ${y + h / 2} ` +
      `L ${x + w / 2} ${y + h} L ${x} ${y + h / 2} Z`
    );
  }

  if (box.shape === "cylinder") {
    // A barrel: two cubic caps, so the outline stays a single closed path.
    const ry = Math.min(h * 0.16, 16);
    const k = ry * 1.34;

    return (
      `M ${x} ${y + ry} C ${x} ${y + ry - k} ${x + w} ${y + ry - k} ${x + w} ${y + ry} ` +
      `V ${y + h - ry} C ${x + w} ${y + h - ry + k} ${x} ${y + h - ry + k} ${x} ${y + h - ry} Z`
    );
  }

  const r = 8;

  return (
    `M ${x + r} ${y} H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w} ${y + r} ` +
    `V ${y + h - r} A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} ` +
    `H ${x + r} A ${r} ${r} 0 0 1 ${x} ${y + h - r} V ${y + r} ` +
    `A ${r} ${r} 0 0 1 ${x + r} ${y} Z`
  );
}

/** Breaks a label into lines short enough to sit inside a shape. */
export function wrapDiagramLabel(label: string, maxChars = 24): string[] {
  const limit = Math.max(6, maxChars);
  const words = label.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;

    if (current && candidate.length > limit) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) lines.push(current);
  if (lines.length === 0) return [""];
  if (lines.length <= LABEL_MAX_LINES) return lines;

  const kept = lines.slice(0, LABEL_MAX_LINES);
  kept[LABEL_MAX_LINES - 1] = `${kept[LABEL_MAX_LINES - 1].slice(0, limit - 1)}…`;
  return kept;
}

/** Label lines sized for this box's shape, so text stays inside the outline. */
export function diagramLabelLines(box: DiagramBox): string[] {
  const shape = isDiagramShape(box.shape) ? box.shape : "box";
  const { width } = diagramShapeSize(box);
  const maxChars = Math.floor((width * SHAPE_TEXT_SHARE[shape]) / LABEL_CHAR_WIDTH);

  return wrapDiagramLabel(box.label, maxChars);
}

export interface SchemaNodeTextLine {
  text: string;
  x: number;
  /** Baseline, in drawing units. */
  y: number;
}

export interface SchemaNodeSeparator {
  x1: number;
  x2: number;
  y: number;
}

export interface SchemaNodeLayout {
  width: number;
  height: number;
  headerHeight: number;
  outlinePath: string;
  headerPath: string;
  title: SchemaNodeTextLine;
  rows: SchemaNodeTextLine[];
  separators: SchemaNodeSeparator[];
}

function roundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
  return (
    `M ${x + r} ${y} H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w} ${y + r} ` +
    `V ${y + h - r} A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} ` +
    `H ${x + r} A ${r} ${r} 0 0 1 ${x} ${y + h - r} V ${y + r} ` +
    `A ${r} ${r} 0 0 1 ${x + r} ${y} Z`
  );
}

function topRoundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
  return (
    `M ${x + r} ${y} H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w} ${y + r} ` +
    `V ${y + h} H ${x} V ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`
  );
}

function truncateText(text: string, maxChars: number): string {
  const limit = Math.max(3, Math.floor(maxChars));
  return text.length <= limit ? text : `${text.slice(0, limit - 1)}…`;
}

/**
 * Geometry for a box that carries field rows: a title band and one row per
 * field. Returns null for a plain box, which keeps the shape's own label.
 */
export function schemaNodeLayout(box: DiagramBox): SchemaNodeLayout | null {
  const fields = normalizeDiagramFields(box.fields);
  if (fields.length === 0) return null;

  const { width, height } = diagramShapeSize(box);
  const radius = 6;
  const titleMaxChars = (width - SCHEMA_PADDING_X * 2) / SCHEMA_TITLE_CHAR_WIDTH;
  const fieldMaxChars = (width - SCHEMA_PADDING_X * 2) / SCHEMA_FIELD_CHAR_WIDTH;
  const areaTop = box.y + SCHEMA_HEADER_HEIGHT + SCHEMA_FIELD_PADDING_Y;

  const rows = fields.map((field, index) => ({
    text: truncateText(field, fieldMaxChars),
    x: box.x + SCHEMA_PADDING_X,
    y: areaTop + index * SCHEMA_FIELD_ROW_HEIGHT + SCHEMA_FIELD_ROW_HEIGHT / 2 + 4,
  }));

  return {
    width,
    height,
    headerHeight: SCHEMA_HEADER_HEIGHT,
    outlinePath: roundedRectPath(box.x, box.y, width, height, radius),
    headerPath: topRoundedRectPath(box.x, box.y, width, SCHEMA_HEADER_HEIGHT, radius),
    title: {
      text: truncateText(box.label, titleMaxChars),
      x: box.x + SCHEMA_PADDING_X,
      y: box.y + SCHEMA_HEADER_HEIGHT / 2 + 4.5,
    },
    rows,
    separators: rows.slice(1).map((_row, index) => ({
      x1: box.x + 8,
      x2: box.x + width - 8,
      y: areaTop + (index + 1) * SCHEMA_FIELD_ROW_HEIGHT,
    })),
  };
}

/**
 * Right-angled route: an elbow mid-way between two horizontal-facing anchors,
 * mid-way vertically between two vertical-facing ones, and a single bend when
 * one end leaves horizontally and the other arrives vertically. Aligned boxes
 * collapse to a straight segment instead of a zero-height zigzag.
 */
function diagramElbowVertices(
  start: DiagramAnchorPoint,
  tip: DiagramAnchorPoint,
  sides: DiagramLinkSides,
): DiagramAnchorPoint[] {
  const leavesHorizontally = sides.from === "left" || sides.from === "right";
  const arrivesHorizontally = sides.to === "left" || sides.to === "right";

  if (leavesHorizontally && arrivesHorizontally) {
    if (start.y === tip.y) return [start, tip];

    const midX = (start.x + tip.x) / 2;
    return [start, { x: midX, y: start.y }, { x: midX, y: tip.y }, tip];
  }

  if (!leavesHorizontally && !arrivesHorizontally) {
    if (start.x === tip.x) return [start, tip];

    const midY = (start.y + tip.y) / 2;
    return [start, { x: start.x, y: midY }, { x: tip.x, y: midY }, tip];
  }

  const bend = leavesHorizontally
    ? { x: tip.x, y: start.y }
    : { x: start.x, y: tip.y };
  return [start, bend, tip];
}

/**
 * From whichever anchor faces the target to the nearest anchor on it, either
 * as one segment or as a right-angled route, with the head included.
 */
export function diagramArrow(
  from: DiagramBox,
  to: DiagramBox,
  routing: DiagramRouting = "straight",
): DiagramArrow {
  const sides = diagramLinkSides(from, to);
  const start = diagramAnchor(from, sides.from);
  const tip = diagramAnchor(to, sides.to);

  const vertices =
    normalizeDiagramRouting(routing) === "elbow"
      ? diagramElbowVertices(start, tip, sides)
      : [start, tip];

  const tipX = tip.x;
  const tipY = tip.y;
  const previous = vertices[vertices.length - 2] ?? start;
  const segmentX = tipX - previous.x;
  const segmentY = tipY - previous.y;
  const length = Math.hypot(segmentX, segmentY) || 1;
  const unitX = segmentX / length;
  const unitY = segmentY / length;
  const baseX = tipX - unitX * ARROW_HEAD_LENGTH;
  const baseY = tipY - unitY * ARROW_HEAD_LENGTH;
  const perpX = -unitY * ARROW_HEAD_HALF_WIDTH;
  const perpY = unitX * ARROW_HEAD_HALF_WIDTH;

  const shaft = [...vertices.slice(0, -1), { x: baseX, y: baseY }];

  return {
    startX: start.x,
    startY: start.y,
    endX: baseX,
    endY: baseY,
    points: shaft.map((vertex) => `${vertex.x},${vertex.y}`).join(" "),
    headPoints: `${tipX},${tipY} ${baseX + perpX},${baseY + perpY} ${baseX - perpX},${baseY - perpY}`,
  };
}

/** One box as SVG: a schema node when it has fields, else its own outline. */
function diagramNodeMarkup(box: DiagramBox, colors: DiagramColors, hasChildren: boolean): string {
  const style = diagramBoxStyle(colors, box.tone);
  const schema = schemaNodeLayout(box);
  const headerTextColor =
    box.tone === "accent" || box.tone === "emphasis" ? colors.onAccent : colors.paper;

  if (schema) {
    const separators = schema.separators
      .map(
        (separator) =>
          `<line x1="${separator.x1}" y1="${separator.y}" x2="${separator.x2}" y2="${separator.y}" ` +
          `stroke="${style.stroke}" stroke-opacity="0.18" stroke-width="1"/>`,
      )
      .join("");
    const rows = schema.rows
      .map(
        (row) =>
          `<text x="${row.x}" y="${row.y}" font-family="${SCHEMA_FIELD_FONT}" font-size="11" ` +
          `fill="${style.text}">${escapeHtml(row.text)}</text>`,
      )
      .join("");

    return (
      `<g><path d="${schema.outlinePath}" fill="${style.fill}" stroke="${style.stroke}" stroke-width="2"/>` +
      `<path d="${schema.headerPath}" fill="${style.stroke}"/>` +
      `<text x="${schema.title.x}" y="${schema.title.y}" font-family="${SCHEMA_TITLE_FONT}" ` +
      `font-size="13" font-weight="600" fill="${headerTextColor}">${escapeHtml(schema.title.text)}</text>` +
      `${separators}${rows}</g>`
    );
  }

  const lines = diagramLabelLines(box);
  const size = diagramShapeSize(box);

  // A container keeps its title at the top, leaving the body to its children.
  if (hasChildren) {
    const spans = lines
      .map(
        (line, index) =>
          `<tspan x="${box.x + 12}" y="${box.y + 20 + index * 16}">${escapeHtml(line)}</tspan>`,
      )
      .join("");

    return (
      `<g><path d="${diagramShapePath(box)}" fill="${style.fill}" stroke="${style.stroke}" ` +
      `stroke-width="2"/>` +
      `<text font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="600" ` +
      `fill="${style.text}" opacity="0.8">${spans}</text></g>`
    );
  }

  const textX = box.x + size.width / 2;
  const firstLineY =
    box.y + size.height / 2 - ((lines.length - 1) * DIAGRAM_LABEL_LINE_HEIGHT) / 2 + 5;
  const spans = lines
    .map(
      (line, index) =>
        `<tspan x="${textX}" y="${firstLineY + index * DIAGRAM_LABEL_LINE_HEIGHT}">${escapeHtml(line)}</tspan>`,
    )
    .join("");

  return (
    `<g><path d="${diagramShapePath(box)}" fill="${style.fill}" stroke="${style.stroke}" ` +
    `stroke-width="2"/>` +
    `<text text-anchor="middle" font-family="Georgia, serif" font-size="16" fill="${style.text}">${spans}</text></g>`
  );
}

/** The whole drawing as one SVG string: arrows first, shapes on top. */
export function buildDiagramSvg({
  boxes,
  links,
  title,
  colors,
  routing,
}: {
  boxes: DiagramBox[];
  links: DiagramLink[];
  title: string;
  colors: DiagramColors;
  routing?: DiagramRouting;
}): string {
  const laidOut = normalizeDiagramBoxes(boxes);
  const boxesById = new Map(laidOut.map((box) => [box.id, box]));

  const arrows = normalizeDiagramLinks(links, laidOut)
    .map((link) => {
      const from = boxesById.get(link.from);
      const to = boxesById.get(link.to);
      if (!from || !to) return "";

      const arrow = diagramArrow(from, to, routing);

      return (
        `<polyline points="${arrow.points}" fill="none" stroke="${colors.accent}" ` +
        `stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>` +
        `<polygon points="${arrow.headPoints}" fill="${colors.accent}"/>`
      );
    })
    .join("");

  const containers = diagramContainerIds(laidOut);
  const nodes = diagramRenderOrder(laidOut)
    .map((box) => diagramNodeMarkup(box, colors, containers.has(box.id)))
    .join("");

  return (
    `<svg viewBox="0 0 ${DIAGRAM_WIDTH} ${DIAGRAM_HEIGHT}" xmlns="http://www.w3.org/2000/svg" ` +
    `role="img" aria-label="${escapeHtml(title)}">${arrows}${nodes}</svg>`
  );
}
