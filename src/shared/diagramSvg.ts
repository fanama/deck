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
 * a shape and a position; links point at those ids. One builder serves the HTML
 * export and the PPTX rasteriser; the preview draws the same geometry with
 * Svelte so it can be dragged.
 */

export const DIAGRAM_WIDTH = 1000;
export const DIAGRAM_HEIGHT = 440;
export const DIAGRAM_LABEL_LINE_HEIGHT = 19;

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

interface ShapeSize {
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
}

/** Used when nothing supplies a deck accent; matches the studio default. */
export const DIAGRAM_COLORS: DiagramColors = {
  accent: "#0f6b64",
  ink: "#12171f",
  muted: "#667485",
  warm: "#b45309",
  paper: "#ffffff",
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
      return { stroke: colors.accent, fill: colors.accent, text: colors.paper };
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
  const { width, height } = diagramShapeSize(box.shape);
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

export function isDiagramShape(value: unknown): value is DiagramShape {
  return typeof value === "string" && DIAGRAM_SHAPES.includes(value as DiagramShape);
}

export function diagramShapeSize(shape: DiagramShape | undefined): ShapeSize {
  return SHAPE_SIZES[isDiagramShape(shape) ? shape : "box"];
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
 * Clamps stored positions to the drawing and fills in what older decks do not
 * have: ids (links need them), shapes and positions.
 */
export function normalizeDiagramBoxes(boxes: DiagramBox[]): DiagramBox[] {
  return boxes.map((box, index) => {
    const shape = isDiagramShape(box.shape) ? box.shape : "box";
    const size = diagramShapeSize(shape);

    return {
      id: typeof box.id === "string" && box.id.trim() ? box.id : `box-${index + 1}`,
      shape,
      tone: isDiagramTone(box.tone) ? box.tone : "accent",
      label: box.label,
      x: coordinate(box.x, DIAGRAM_WIDTH - size.width, fallbackX(index)),
      y: coordinate(box.y, DIAGRAM_HEIGHT - size.height, fallbackY(index)),
    };
  });
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

/** The outline of one shape, as an SVG `d` attribute. */
export function diagramShapePath(box: DiagramBox): string {
  const { width: w, height: h } = diagramShapeSize(box.shape);
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
  const { width } = diagramShapeSize(shape);
  const maxChars = Math.floor((width * SHAPE_TEXT_SHARE[shape]) / LABEL_CHAR_WIDTH);

  return wrapDiagramLabel(box.label, maxChars);
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

  const nodes = laidOut
    .map((box) => {
      const lines = diagramLabelLines(box);
      const size = diagramShapeSize(box.shape);
      const style = diagramBoxStyle(colors, box.tone);
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
    })
    .join("");

  return (
    `<svg viewBox="0 0 ${DIAGRAM_WIDTH} ${DIAGRAM_HEIGHT}" xmlns="http://www.w3.org/2000/svg" ` +
    `role="img" aria-label="${escapeHtml(title)}">${arrows}${nodes}</svg>`
  );
}
