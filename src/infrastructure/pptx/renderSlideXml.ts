import type {
  CardsSlideContent,
  ClosingSlideContent,
  Deck,
  DiagramSlideContent,
  FlowLane,
  FlowSlideContent,
  MetaRow,
  RulesSlideContent,
  Slide,
  StatementSlideContent,
  TableSlideContent,
  TechnicalSlideContent,
  TitleSlideContent,
} from "../../domain/deck/slideTypes.ts";
import { SHAPE_TREE_CLOSE, SHAPE_TREE_OPEN, pictureXml, shapeXml, slideBackgroundXml } from "./pptxShapes.ts";
import type { ShapeFill } from "./pptxShapes.ts";
import { estimateTextWidth, measureText, textBoxXml } from "./pptxText.ts";
import type { ParagraphSpec, TextStyle } from "./pptxText.ts";
import { frameForLayout, paletteForTheme } from "./pptxUnits.ts";
import type { Palette, SlideFrame } from "./pptxUnits.ts";

/**
 * One renderer per layout, mirroring `renderSlideHtml.ts` box for box. Every
 * heading, bullet, card and rule becomes a native shape or text box, so the
 * deck stays editable in PowerPoint instead of arriving as flat pictures.
 *
 * Heights are estimated from the content (see `pptxText.ts`) because nothing
 * measures text here; PowerPoint re-wraps when it opens the file.
 */

interface SlideCanvas {
  frame: SlideFrame;
  palette: Palette;
  shapes: string[];
  nextId: () => number;
}

const BODY_GAP = 26;
const EYEBROW_HEIGHT = 15;
/** Body block more than this is the footer's margin plus its own rule. */
const FOOTER_RESERVE = 48;
const CARD_GAP = 18;

function createCanvas(frame: SlideFrame, palette: Palette): SlideCanvas {
  let nextShapeId = 2;
  return { frame, palette, shapes: [], nextId: () => nextShapeId++ };
}

function writeText(
  canvas: SlideCanvas,
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  paragraphs: ParagraphSpec[],
  anchor?: "t" | "ctr" | "b",
): void {
  canvas.shapes.push(
    textBoxXml({ id: canvas.nextId(), name, x, y, width, height: Math.max(height, 8), paragraphs, anchor }),
  );
}

/** Width of `characters` characters at this size, used to honour CSS `ch` caps. */
function lineLengthPx(fontPx: number, characters: number, family: TextStyle["family"]): number {
  return estimateTextWidth("x".repeat(characters), { fontPx, lineHeight: 1, family, color: "000000" });
}

function writeEyebrow(canvas: SlideCanvas, eyebrow: string, color: string): number {
  if (!eyebrow.trim()) return canvas.frame.top;

  const style: TextStyle = {
    fontPx: 12.5,
    lineHeight: 1.2,
    family: "sans",
    bold: true,
    caps: true,
    letterSpacingPx: 2,
    color,
  };

  writeText(canvas, "Eyebrow", canvas.frame.x, canvas.frame.top, canvas.frame.width, EYEBROW_HEIGHT, [
    { text: eyebrow, style },
  ]);

  return canvas.frame.top + EYEBROW_HEIGHT;
}

function writeFooter(
  canvas: SlideCanvas,
  footerLabel: string,
  slideNumber: number,
  totalSlides: number,
  isDark: boolean,
): void {
  const { frame, palette } = canvas;
  const textTop = frame.bottom - 16;
  const ruleY = textTop - 14;

  canvas.shapes.push(
    shapeXml({
      id: canvas.nextId(),
      name: "Footer rule",
      x: frame.x,
      y: ruleY,
      width: frame.width,
      height: 1,
      fill: isDark ? { color: "FFFFFF", alpha: 0.16 } : palette.line,
    }),
  );

  const style: TextStyle = {
    fontPx: 12,
    lineHeight: 1.2,
    family: "sans",
    color: isDark ? palette.darkMuted : palette.muted,
  };

  if (footerLabel.trim()) {
    writeText(canvas, "Footer label", frame.x, textTop, frame.width * 0.7, 16, [{ text: footerLabel, style }]);
  }

  writeText(canvas, "Slide number", frame.x + frame.width - 140, textTop, 140, 16, [
    { text: `${slideNumber} / ${totalSlides}`, style, align: "r" },
  ]);
}

function bodyRegion(canvas: SlideCanvas, eyebrowBottom: number): { top: number; bottom: number } {
  return { top: eyebrowBottom + 14, bottom: canvas.frame.bottom - FOOTER_RESERVE };
}

function centeredTop(region: { top: number; bottom: number }, blockHeightPx: number): number {
  return region.top + Math.max(0, (region.bottom - region.top - blockHeightPx) / 2);
}

function bulletParagraphs(points: string[], style: TextStyle, bulletColor: string): ParagraphSpec[] {
  return points.map((point, index) => ({
    text: point,
    style,
    bulletColor,
    spaceAfterPx: index === points.length - 1 ? 0 : 12,
  }));
}

function measurePoints(points: string[], style: TextStyle, widthPx: number): number {
  if (points.length === 0) return 0;

  // The bullet indent costs 24px of usable line width, as in `ul.clean li`.
  const lineWidth = Math.max(80, widthPx - 24);
  const height = points.reduce((total, point) => total + measureText(point, style, lineWidth).heightPx, 0);
  return height + (points.length - 1) * 12;
}

/* -- pills --------------------------------------------------------------- */

interface PillPlacement {
  text: string;
  x: number;
  y: number;
  width: number;
}

function pillStyle(color: string): TextStyle {
  return { fontPx: 12.5, lineHeight: 1.2, family: "sans", bold: true, color };
}

function arrangePills(pills: string[], maxWidthPx: number, style: TextStyle): { placements: PillPlacement[]; heightPx: number } {
  const placements: PillPlacement[] = [];
  const rowGap = 8;
  const pillGap = 8;
  const pillHeight = 28;

  let x = 0;
  let row = 0;

  for (const pill of pills) {
    const width = Math.min(maxWidthPx, estimateTextWidth(pill, style) + 26);

    if (x > 0 && x + width > maxWidthPx) {
      row += 1;
      x = 0;
    }

    placements.push({ text: pill, x, y: row * (pillHeight + rowGap), width });
    x += width + pillGap;
  }

  const rows = row + 1;
  return { placements, heightPx: rows * pillHeight + (rows - 1) * rowGap };
}

function writePills(canvas: SlideCanvas, pills: string[], originY: number, maxWidthPx: number): void {
  const { frame } = canvas;
  const style = pillStyle("E7F3F0");
  const { placements } = arrangePills(pills, maxWidthPx, style);

  for (const placement of placements) {
    canvas.shapes.push(
      shapeXml({
        id: canvas.nextId(),
        name: `Pill ${placement.text}`,
        x: frame.x + placement.x,
        y: originY + placement.y,
        width: placement.width,
        height: 28,
        geometry: "roundRect",
        radiusPx: 14,
        fill: { color: "FFFFFF", alpha: 0.1 },
        line: { color: "FFFFFF", widthPx: 1, alpha: 0.24 },
      }),
    );

    writeText(
      canvas,
      `Pill ${placement.text}`,
      frame.x + placement.x,
      originY + placement.y,
      placement.width,
      28,
      [{ text: placement.text, style, align: "ctr" }],
      "ctr",
    );
  }
}

/* -- cover (title and closing) ------------------------------------------- */

function measureMetaRows(rows: MetaRow[], widthPx: number): { rowHeights: number[]; heightPx: number } {
  const labelStyle: TextStyle = {
    fontPx: 11.5,
    lineHeight: 1.2,
    family: "sans",
    bold: true,
    caps: true,
    letterSpacingPx: 1.5,
    color: "8FB6AE",
  };
  const valueStyle: TextStyle = { fontPx: 15, lineHeight: 1.35, family: "sans", color: "EAF3F1" };

  const rowHeights = rows.map(
    (row) => 11 + measureText(row.label, labelStyle, widthPx).heightPx + 4 + measureText(row.value, valueStyle, widthPx).heightPx,
  );

  const heightPx = rowHeights.reduce((total, rowHeight) => total + rowHeight, 0) + Math.max(0, rows.length - 1) * 14;
  return { rowHeights, heightPx };
}

function writeMetaRows(canvas: SlideCanvas, rows: MetaRow[], x: number, y: number, widthPx: number): void {
  const labelStyle: TextStyle = {
    fontPx: 11.5,
    lineHeight: 1.2,
    family: "sans",
    bold: true,
    caps: true,
    letterSpacingPx: 1.5,
    color: "8FB6AE",
  };
  const valueStyle: TextStyle = { fontPx: 15, lineHeight: 1.35, family: "sans", color: "EAF3F1" };
  const { rowHeights } = measureMetaRows(rows, widthPx);

  let cursor = y;

  rows.forEach((row, index) => {
    canvas.shapes.push(
      shapeXml({
        id: canvas.nextId(),
        name: "Meta rule",
        x,
        y: cursor,
        width: widthPx,
        height: 1,
        fill: { color: "FFFFFF", alpha: 0.18 },
      }),
    );

    const labelHeight = measureText(row.label, labelStyle, widthPx).heightPx;
    writeText(canvas, "Meta label", x, cursor + 11, widthPx, labelHeight + 2, [{ text: row.label, style: labelStyle }]);

    const value = measureText(row.value, valueStyle, widthPx);
    writeText(canvas, "Meta value", x, cursor + 11 + labelHeight + 4, widthPx, value.heightPx + 2, [
      { text: row.value, style: valueStyle },
    ]);

    cursor += rowHeights[index] + 14;
  });
}

function renderCoverSlide(
  canvas: SlideCanvas,
  content: TitleSlideContent | ClosingSlideContent,
  pills: string[] | null,
): void {
  const { frame, palette } = canvas;
  const eyebrowBottom = writeEyebrow(canvas, content.eyebrow, palette.darkMuted);

  const headingStyle: TextStyle = { fontPx: 62, lineHeight: 1.04, family: "serif", bold: true, color: "FFFFFF" };
  const ledeStyle: TextStyle = { fontPx: 20, lineHeight: 1.5, family: "sans", color: "C6DCD7" };

  const columnGap = 40;
  const leftWidth = (frame.width - columnGap) * 0.625;
  const rightWidth = frame.width - columnGap - leftWidth;

  const headingWidth = Math.min(leftWidth, lineLengthPx(62, 17, "serif"));
  const heading = measureText(content.heading, headingStyle, headingWidth);
  const lede = content.lede.trim() ? measureText(content.lede, ledeStyle, Math.min(leftWidth, lineLengthPx(20, 58, "sans"))) : null;
  const pillsBlock = pills && pills.length > 0 ? arrangePills(pills, leftWidth, pillStyle("E7F3F0")) : null;
  const meta = content.meta.length > 0 ? measureMetaRows(content.meta, rightWidth) : null;

  const leftHeight = heading.heightPx + (lede ? 18 + lede.heightPx : 0) + (pillsBlock ? 26 + pillsBlock.heightPx : 0);
  const blockHeight = Math.max(leftHeight, meta?.heightPx ?? 0);
  const region = bodyRegion(canvas, eyebrowBottom);
  const top = centeredTop(region, blockHeight);

  writeText(canvas, "Heading", frame.x, top, headingWidth, heading.heightPx + 6, [
    { text: content.heading, style: headingStyle },
  ]);

  let cursor = top + heading.heightPx;

  if (lede) {
    cursor += 18;
    writeText(canvas, "Lede", frame.x, cursor, Math.min(leftWidth, lineLengthPx(20, 58, "sans")), lede.heightPx + 4, [
      { text: content.lede, style: ledeStyle },
    ]);
    cursor += lede.heightPx;
  }

  if (pills) {
    cursor += 26;
    writePills(canvas, pills, cursor, leftWidth);
  }

  if (meta) {
    writeMetaRows(canvas, content.meta, frame.x + leftWidth + columnGap, top + blockHeight - meta.heightPx, rightWidth);
  }
}

/* -- cards --------------------------------------------------------------- */

function renderCardsSlide(canvas: SlideCanvas, content: CardsSlideContent): void {
  const { frame, palette } = canvas;
  const eyebrowBottom = writeEyebrow(canvas, content.eyebrow, palette.muted);

  const headingStyle: TextStyle = { fontPx: 40, lineHeight: 1.12, family: "serif", bold: true, color: palette.ink };
  const markerStyle: TextStyle = { fontPx: 15, lineHeight: 1.2, family: "serif", bold: true, color: palette.accent };
  const titleStyle: TextStyle = { fontPx: 16, lineHeight: 1.3, family: "sans", bold: true, color: palette.ink };
  const bodyStyle: TextStyle = { fontPx: 14.5, lineHeight: 1.55, family: "sans", color: palette.inkSoft };
  const noteStyle: TextStyle = { fontPx: 14, lineHeight: 1.5, family: "sans", color: palette.muted };

  const heading = measureText(content.heading, headingStyle, Math.min(frame.width, lineLengthPx(40, 34, "serif")));
  const cardCount = Math.max(1, content.cards.length);
  const cardWidth = (frame.width - CARD_GAP * (cardCount - 1)) / cardCount;
  const cardInnerWidth = cardWidth - 44;

  const cardHeights = content.cards.map(
    (card) =>
      20 +
      measureText(card.marker, markerStyle, cardInnerWidth).heightPx +
      10 +
      measureText(card.title, titleStyle, cardInnerWidth).heightPx +
      6 +
      measureText(card.body, bodyStyle, cardInnerWidth).heightPx +
      20,
  );
  const cardHeight = Math.max(1, ...cardHeights);
  const note = content.note.trim() ? measureText(content.note, noteStyle, frame.width) : null;

  const blockHeight = heading.heightPx + BODY_GAP + cardHeight + (note ? BODY_GAP + note.heightPx : 0);
  const top = centeredTop(bodyRegion(canvas, eyebrowBottom), blockHeight);

  writeText(canvas, "Heading", frame.x, top, Math.min(frame.width, lineLengthPx(40, 34, "serif")), heading.heightPx + 6, [
    { text: content.heading, style: headingStyle },
  ]);

  const cardsTop = top + heading.heightPx + BODY_GAP;

  content.cards.forEach((card, index) => {
    const x = frame.x + index * (cardWidth + CARD_GAP);

    canvas.shapes.push(
      shapeXml({
        id: canvas.nextId(),
        name: `Card ${index + 1}`,
        x,
        y: cardsTop,
        width: cardWidth,
        height: cardHeight,
        geometry: "roundRect",
        radiusPx: 4,
        fill: palette.panel,
        line: { color: palette.line },
      }),
    );

    const markerHeight = measureText(card.marker, markerStyle, cardInnerWidth).heightPx;
    writeText(canvas, `Card ${index + 1} marker`, x + 22, cardsTop + 20, cardInnerWidth, markerHeight + 2, [
      { text: card.marker, style: markerStyle },
    ]);

    const titleHeight = measureText(card.title, titleStyle, cardInnerWidth).heightPx;
    writeText(canvas, `Card ${index + 1} title`, x + 22, cardsTop + 20 + markerHeight + 10, cardInnerWidth, titleHeight + 2, [
      { text: card.title, style: titleStyle },
    ]);

    const body = measureText(card.body, bodyStyle, cardInnerWidth);
    writeText(
      canvas,
      `Card ${index + 1} body`,
      x + 22,
      cardsTop + 20 + markerHeight + 10 + titleHeight + 6,
      cardInnerWidth,
      body.heightPx + 4,
      [{ text: card.body, style: bodyStyle }],
    );
  });

  if (note) {
    writeText(canvas, "Footnote", frame.x, cardsTop + cardHeight + BODY_GAP, frame.width, note.heightPx + 2, [
      { text: content.note, style: noteStyle },
    ]);
  }
}

/* -- flow ---------------------------------------------------------------- */

const NODE_ARROW_WIDTH = 28;

function measureLane(lane: FlowLane, rowWidth: number): number {
  const titleStyle: TextStyle = { fontPx: 13, lineHeight: 1.35, family: "sans", bold: true, color: "12171F" };
  const detailStyle: TextStyle = { fontPx: 11.5, lineHeight: 1.35, family: "sans", color: "667485" };
  const nodeCount = Math.max(1, lane.nodes.length);
  const nodeWidth = (rowWidth - NODE_ARROW_WIDTH * (nodeCount - 1)) / nodeCount;

  const nodeHeight = lane.nodes.reduce(
    (tallest, node) =>
      Math.max(
        tallest,
        18 +
          measureText(node.title, titleStyle, nodeWidth - 24).heightPx +
          measureText(node.detail, detailStyle, nodeWidth - 24).heightPx,
      ),
    0,
  );

  return Math.max(nodeHeight, 18) + 28;
}

function renderFlowSlide(canvas: SlideCanvas, content: FlowSlideContent): void {
  const { frame, palette } = canvas;
  const eyebrowBottom = writeEyebrow(canvas, content.eyebrow, palette.muted);

  const headingStyle: TextStyle = { fontPx: 40, lineHeight: 1.12, family: "serif", bold: true, color: palette.ink };
  const labelStyle: TextStyle = {
    fontPx: 12.5,
    lineHeight: 1.2,
    family: "sans",
    bold: true,
    caps: true,
    letterSpacingPx: 1.5,
    color: palette.accent,
  };
  const nodeTitleStyle: TextStyle = { fontPx: 13, lineHeight: 1.35, family: "sans", bold: true, color: "12171F" };
  const nodeDetailStyle: TextStyle = { fontPx: 11.5, lineHeight: 1.35, family: "sans", color: "667485" };
  const arrowStyle: TextStyle = { fontPx: 15, lineHeight: 1.2, family: "sans", color: "9AA8A5" };
  const noteStyle: TextStyle = { fontPx: 14, lineHeight: 1.5, family: "sans", color: palette.muted };

  const heading = measureText(content.heading, headingStyle, Math.min(frame.width, lineLengthPx(40, 34, "serif")));

  const laneLabelWidth = 150;
  const labelGap = 16;
  const rowWidth = frame.width - 32 - laneLabelWidth - labelGap;
  const laneHeights = content.lanes.map((lane) => measureLane(lane, rowWidth));
  const lanesHeight =
    laneHeights.reduce((total, laneHeight) => total + laneHeight, 0) + Math.max(0, content.lanes.length - 1) * 14;
  const note = content.note.trim() ? measureText(content.note, noteStyle, frame.width) : null;

  const blockHeight = heading.heightPx + BODY_GAP + lanesHeight + (note ? BODY_GAP + note.heightPx : 0);
  const top = centeredTop(bodyRegion(canvas, eyebrowBottom), blockHeight);

  writeText(canvas, "Heading", frame.x, top, Math.min(frame.width, lineLengthPx(40, 34, "serif")), heading.heightPx + 6, [
    { text: content.heading, style: headingStyle },
  ]);

  let laneTop = top + heading.heightPx + BODY_GAP;

  content.lanes.forEach((lane, laneIndex) => {
    const laneHeight = laneHeights[laneIndex];

    canvas.shapes.push(
      shapeXml({
        id: canvas.nextId(),
        name: `Lane ${laneIndex + 1}`,
        x: frame.x,
        y: laneTop,
        width: frame.width,
        height: laneHeight,
        geometry: "roundRect",
        radiusPx: 4,
        fill: palette.panel,
        line: { color: palette.line },
      }),
    );

    writeText(canvas, `Lane ${laneIndex + 1} label`, frame.x + 16, laneTop, laneLabelWidth, laneHeight, [
      { text: lane.label, style: labelStyle },
    ], "ctr");

    const rowX = frame.x + 16 + laneLabelWidth + labelGap;
    const nodeCount = Math.max(1, lane.nodes.length);
    const nodeWidth = (rowWidth - NODE_ARROW_WIDTH * (nodeCount - 1)) / nodeCount;
    const nodeTop = laneTop + 14;
    const nodeHeight = laneHeight - 28;

    lane.nodes.forEach((node, nodeIndex) => {
      const nodeX = rowX + nodeIndex * (nodeWidth + NODE_ARROW_WIDTH);

      if (nodeIndex > 0) {
        writeText(canvas, `Arrow ${nodeIndex}`, nodeX - NODE_ARROW_WIDTH, nodeTop, NODE_ARROW_WIDTH, nodeHeight, [
          { text: "→", style: arrowStyle, align: "ctr" },
        ], "ctr");
      }

      canvas.shapes.push(
        shapeXml({
          id: canvas.nextId(),
          name: `Node ${laneIndex + 1}.${nodeIndex + 1}`,
          x: nodeX,
          y: nodeTop,
          width: nodeWidth,
          height: nodeHeight,
          radiusPx: 3,
          fill: "FFFFFF",
          line: { color: "CFD6D3" },
        }),
      );

      writeText(
        canvas,
        `Node ${laneIndex + 1}.${nodeIndex + 1} text`,
        nodeX + 12,
        nodeTop + 9,
        nodeWidth - 24,
        nodeHeight - 18,
        [
          { text: node.title, style: nodeTitleStyle },
          { text: node.detail, style: nodeDetailStyle },
        ],
        "ctr",
      );
    });

    laneTop += laneHeight + 14;
  });

  if (note) {
    writeText(canvas, "Footnote", frame.x, laneTop - 14 + BODY_GAP, frame.width, note.heightPx + 2, [
      { text: content.note, style: noteStyle },
    ]);
  }
}

/* -- rules --------------------------------------------------------------- */

function renderRulesSlide(canvas: SlideCanvas, content: RulesSlideContent): void {
  const { frame, palette } = canvas;
  const eyebrowBottom = writeEyebrow(canvas, content.eyebrow, palette.muted);

  const headingStyle: TextStyle = { fontPx: 40, lineHeight: 1.12, family: "serif", bold: true, color: palette.ink };
  const markerStyle: TextStyle = { fontPx: 17, lineHeight: 1.2, family: "serif", bold: true, color: palette.accent };
  const statementStyle: TextStyle = { fontPx: 14.5, lineHeight: 1.5, family: "sans", color: palette.inkSoft };
  const noteStyle: TextStyle = { fontPx: 14, lineHeight: 1.5, family: "sans", color: palette.muted };

  const heading = measureText(content.heading, headingStyle, Math.min(frame.width, lineLengthPx(40, 34, "serif")));
  const statementWidth = frame.width - 32 - 34 - 14;
  const ruleHeights = content.rules.map(
    (rule) => 26 + Math.max(measureText(rule.marker, markerStyle, 34).heightPx, measureText(rule.statement, statementStyle, statementWidth).heightPx),
  );
  const rulesHeight = ruleHeights.reduce((total, height) => total + height, 0) + Math.max(0, content.rules.length - 1) * 10;
  const note = content.note.trim() ? measureText(content.note, noteStyle, frame.width) : null;

  const blockHeight = heading.heightPx + BODY_GAP + rulesHeight + (note ? BODY_GAP + note.heightPx : 0);
  const top = centeredTop(bodyRegion(canvas, eyebrowBottom), blockHeight);

  writeText(canvas, "Heading", frame.x, top, Math.min(frame.width, lineLengthPx(40, 34, "serif")), heading.heightPx + 6, [
    { text: content.heading, style: headingStyle },
  ]);

  let ruleTop = top + heading.heightPx + BODY_GAP;

  content.rules.forEach((rule, index) => {
    const ruleHeight = ruleHeights[index];

    canvas.shapes.push(
      shapeXml({
        id: canvas.nextId(),
        name: `Rule ${index + 1}`,
        x: frame.x,
        y: ruleTop,
        width: frame.width,
        height: ruleHeight,
        fill: palette.panel,
      }),
    );

    canvas.shapes.push(
      shapeXml({
        id: canvas.nextId(),
        name: `Rule ${index + 1} accent`,
        x: frame.x,
        y: ruleTop,
        width: 2,
        height: ruleHeight,
        fill: palette.accent,
      }),
    );

    writeText(canvas, `Rule ${index + 1} marker`, frame.x + 16, ruleTop + 13, 34, ruleHeight - 26, [
      { text: rule.marker, style: markerStyle },
    ]);

    writeText(canvas, `Rule ${index + 1} statement`, frame.x + 16 + 34 + 14, ruleTop + 13, statementWidth, ruleHeight - 26, [
      { text: rule.statement, style: statementStyle },
    ]);

    ruleTop += ruleHeight + 10;
  });

  if (note) {
    writeText(canvas, "Footnote", frame.x, ruleTop - 10 + BODY_GAP, frame.width, note.heightPx + 2, [
      { text: content.note, style: noteStyle },
    ]);
  }
}

/* -- statement ----------------------------------------------------------- */

function renderStatementSlide(canvas: SlideCanvas, content: StatementSlideContent): void {
  const { frame, palette } = canvas;
  const eyebrowBottom = writeEyebrow(canvas, content.eyebrow, palette.muted);

  const headingStyle: TextStyle = { fontPx: 40, lineHeight: 1.12, family: "serif", bold: true, color: palette.ink };
  const pointStyle: TextStyle = { fontPx: 15.5, lineHeight: 1.5, family: "sans", color: palette.inkSoft };
  const figureStyle: TextStyle = { fontPx: 44, lineHeight: 1, family: "serif", bold: true, color: palette.ink };
  const captionStyle: TextStyle = { fontPx: 13, lineHeight: 1.4, family: "sans", color: palette.muted };

  const heading = measureText(content.heading, headingStyle, Math.min(frame.width, lineLengthPx(40, 34, "serif")));
  const columnGap = 48;
  const columnWidth = (frame.width - columnGap) / 2;
  const pointsHeight = measurePoints(content.points, pointStyle, columnWidth);
  const caption = measureText(content.figureCaption, captionStyle, columnWidth - 48);
  const cardHeight = 48 + measureText(content.figure, figureStyle, columnWidth - 48).heightPx + 8 + caption.heightPx;
  const columnsHeight = Math.max(pointsHeight, cardHeight);

  const blockHeight = heading.heightPx + BODY_GAP + columnsHeight;
  const top = centeredTop(bodyRegion(canvas, eyebrowBottom), blockHeight);

  writeText(canvas, "Heading", frame.x, top, Math.min(frame.width, lineLengthPx(40, 34, "serif")), heading.heightPx + 6, [
    { text: content.heading, style: headingStyle },
  ]);

  const columnsTop = top + heading.heightPx + BODY_GAP;
  const pointsTop = columnsTop + (columnsHeight - pointsHeight) / 2;

  writeText(
    canvas,
    "Points",
    frame.x,
    pointsTop,
    columnWidth,
    pointsHeight + 4,
    bulletParagraphs(content.points, pointStyle, palette.accent),
  );

  const cardX = frame.x + columnWidth + columnGap;
  const cardTop = columnsTop + (columnsHeight - cardHeight) / 2;

  canvas.shapes.push(
    shapeXml({
      id: canvas.nextId(),
      name: "Figure card",
      x: cardX,
      y: cardTop,
      width: columnWidth,
      height: cardHeight,
      geometry: "roundRect",
      radiusPx: 4,
      fill: palette.panel,
      line: { color: palette.line },
    }),
  );

  const figureHeight = measureText(content.figure, figureStyle, columnWidth - 48).heightPx;
  writeText(canvas, "Figure", cardX + 24, cardTop + 24, columnWidth - 48, figureHeight + 2, [
    { text: content.figure, style: figureStyle },
  ]);

  writeText(canvas, "Figure caption", cardX + 24, cardTop + 24 + figureHeight + 8, columnWidth - 48, caption.heightPx + 4, [
    { text: content.figureCaption, style: captionStyle },
  ]);
}

/* -- table --------------------------------------------------------------- */

const TABLE_LABEL_COLUMN_SHARE = 0.28;
const TABLE_ROW_PADDING = 5;

function renderTableSlide(canvas: SlideCanvas, content: TableSlideContent): void {
  const { frame, palette } = canvas;
  const eyebrowBottom = writeEyebrow(canvas, content.eyebrow, palette.muted);

  const headingStyle: TextStyle = { fontPx: 40, lineHeight: 1.12, family: "serif", bold: true, color: palette.ink };
  const headerStyle: TextStyle = {
    fontPx: 10,
    lineHeight: 1.2,
    family: "sans",
    bold: true,
    caps: true,
    letterSpacingPx: 1.5,
    color: palette.muted,
  };
  const labelStyle: TextStyle = { fontPx: 11.5, lineHeight: 1.25, family: "mono", bold: true, color: palette.ink };
  const detailStyle: TextStyle = { fontPx: 9.5, lineHeight: 1.25, family: "sans", color: palette.muted };
  const cellStyle: TextStyle = { fontPx: 11.5, lineHeight: 1.3, family: "sans", color: palette.inkSoft };
  const noteStyle: TextStyle = { fontPx: 14, lineHeight: 1.5, family: "sans", color: palette.muted };

  const heading = measureText(content.heading, headingStyle, Math.min(frame.width, lineLengthPx(40, 34, "serif")));

  const labelWidth = frame.width * TABLE_LABEL_COLUMN_SHARE;
  const dataColumnCount = Math.max(1, content.columns.length);
  const columnWidth = (frame.width - labelWidth) / dataColumnCount;
  const headerHeight = measureText(content.rowHeader, headerStyle, labelWidth).heightPx;
  const ruleGap = 6;

  const rowHeights = content.rows.map((row) => {
    const labelHeight = measureText(row.label, labelStyle, labelWidth - 12).heightPx;
    const detailHeight = row.detail.trim() ? measureText(row.detail, detailStyle, labelWidth - 12).heightPx : 0;
    const cellHeights = content.columns.map(
      (_column, index) => measureText(row.cells[index] ?? "", cellStyle, columnWidth - 12).heightPx,
    );

    return Math.max(labelHeight + detailHeight, ...cellHeights, 0) + TABLE_ROW_PADDING * 2;
  });
  const rowsHeight = rowHeights.reduce((total, rowHeight) => total + rowHeight, 0);
  const note = content.note.trim() ? measureText(content.note, noteStyle, frame.width) : null;

  const blockHeight =
    heading.heightPx + BODY_GAP + headerHeight + ruleGap + rowsHeight + (note ? BODY_GAP + note.heightPx : 0);
  const top = centeredTop(bodyRegion(canvas, eyebrowBottom), blockHeight);

  writeText(canvas, "Heading", frame.x, top, Math.min(frame.width, lineLengthPx(40, 34, "serif")), heading.heightPx + 6, [
    { text: content.heading, style: headingStyle },
  ]);

  const headerTop = top + heading.heightPx + BODY_GAP;
  writeText(canvas, "Column header", frame.x, headerTop, labelWidth, headerHeight + 2, [
    { text: content.rowHeader, style: headerStyle },
  ]);

  content.columns.forEach((column, index) => {
    writeText(
      canvas,
      `Column header ${index + 1}`,
      frame.x + labelWidth + index * columnWidth,
      headerTop,
      columnWidth,
      headerHeight + 2,
      [{ text: column, style: headerStyle }],
    );
  });

  const headerRuleY = headerTop + headerHeight + ruleGap - 2;

  canvas.shapes.push(
    shapeXml({
      id: canvas.nextId(),
      name: "Table header rule",
      x: frame.x,
      y: headerRuleY,
      width: frame.width,
      height: 1,
      fill: palette.ink,
    }),
  );

  let rowTop = headerRuleY + 1;

  content.rows.forEach((row, rowIndex) => {
    if (rowIndex > 0) {
      canvas.shapes.push(
        shapeXml({
          id: canvas.nextId(),
          name: `Row ${rowIndex + 1} rule`,
          x: frame.x,
          y: rowTop,
          width: frame.width,
          height: 1,
          fill: palette.line,
        }),
      );
    }

    const labelHeight = measureText(row.label, labelStyle, labelWidth - 12).heightPx;
    writeText(canvas, `Row ${rowIndex + 1} label`, frame.x, rowTop + TABLE_ROW_PADDING, labelWidth - 14, labelHeight + 2, [
      { text: row.label, style: labelStyle },
    ]);

    if (row.detail.trim()) {
      const detail = measureText(row.detail, detailStyle, labelWidth - 12);
      writeText(
        canvas,
        `Row ${rowIndex + 1} detail`,
        frame.x,
        rowTop + TABLE_ROW_PADDING + labelHeight,
        labelWidth - 14,
        detail.heightPx + 2,
        [{ text: row.detail, style: detailStyle }],
      );
    }

    content.columns.forEach((_column, columnIndex) => {
      const cellText = row.cells[columnIndex] ?? "";
      const cell = measureText(cellText, cellStyle, columnWidth - 12);

      writeText(
        canvas,
        `Row ${rowIndex + 1} cell ${columnIndex + 1}`,
        frame.x + labelWidth + columnIndex * columnWidth,
        rowTop + TABLE_ROW_PADDING,
        columnWidth - 12,
        cell.heightPx + 2,
        [{ text: cellText, style: cellStyle }],
      );
    });

    rowTop += rowHeights[rowIndex];
  });

  if (note) {
    writeText(canvas, "Footnote", frame.x, rowTop + BODY_GAP, frame.width, note.heightPx + 2, [
      { text: content.note, style: noteStyle },
    ]);
  }
}

/* -- technical ----------------------------------------------------------- */

function renderTechnicalSlide(canvas: SlideCanvas, content: TechnicalSlideContent): void {
  const { frame, palette } = canvas;
  const eyebrowBottom = writeEyebrow(canvas, content.eyebrow, palette.darkMuted);

  const headingStyle: TextStyle = { fontPx: 40, lineHeight: 1.12, family: "serif", bold: true, color: "FFFFFF" };
  const pointStyle: TextStyle = { fontPx: 15.5, lineHeight: 1.5, family: "sans", color: "B9CDC9" };
  const cardTitleStyle: TextStyle = { fontPx: 16, lineHeight: 1.3, family: "sans", bold: true, color: "FFFFFF" };
  const monoStyle: TextStyle = { fontPx: 12.5, lineHeight: 1.35, family: "mono", color: palette.darkMono };
  const noteStyle: TextStyle = { fontPx: 14, lineHeight: 1.5, family: "sans", color: "B9CDC9" };

  const heading = measureText(content.heading, headingStyle, Math.min(frame.width, lineLengthPx(40, 34, "serif")));
  const columnGap = 36;
  const columnWidth = (frame.width - columnGap) / 2;
  const pointsHeight = measurePoints(content.points, pointStyle, columnWidth);

  const cardInnerWidth = columnWidth - 44;
  const cardTitle = measureText(content.componentsTitle, cardTitleStyle, cardInnerWidth);
  const componentLines = content.components.map((component) => measureText(component, monoStyle, cardInnerWidth).heightPx);
  const componentsHeight = componentLines.reduce((total, height) => total + height, 0) + Math.max(0, content.components.length - 1) * 8;
  const note = content.note.trim() ? measureText(content.note, noteStyle, cardInnerWidth) : null;
  const cardHeight = 44 + cardTitle.heightPx + 6 + componentsHeight + (note ? 14 + note.heightPx : 0);

  const columnsHeight = Math.max(pointsHeight, cardHeight);
  const blockHeight = heading.heightPx + BODY_GAP + columnsHeight;
  const top = centeredTop(bodyRegion(canvas, eyebrowBottom), blockHeight);

  writeText(canvas, "Heading", frame.x, top, Math.min(frame.width, lineLengthPx(40, 34, "serif")), heading.heightPx + 6, [
    { text: content.heading, style: headingStyle },
  ]);

  const columnsTop = top + heading.heightPx + BODY_GAP;
  writeText(
    canvas,
    "Points",
    frame.x,
    columnsTop + (columnsHeight - pointsHeight) / 2,
    columnWidth,
    pointsHeight + 4,
    bulletParagraphs(content.points, pointStyle, palette.darkMono),
  );

  const cardX = frame.x + columnWidth + columnGap;
  const cardTop = columnsTop + (columnsHeight - cardHeight) / 2;

  canvas.shapes.push(
    shapeXml({
      id: canvas.nextId(),
      name: "Components card",
      x: cardX,
      y: cardTop,
      width: columnWidth,
      height: cardHeight,
      geometry: "roundRect",
      radiusPx: 4,
      fill: palette.darkPanel,
      line: { color: palette.darkLine },
    }),
  );

  writeText(canvas, "Components title", cardX + 22, cardTop + 22, cardInnerWidth, cardTitle.heightPx + 2, [
    { text: content.componentsTitle, style: cardTitleStyle },
  ]);

  let componentTop = cardTop + 22 + cardTitle.heightPx + 6;

  content.components.forEach((component, index) => {
    writeText(canvas, `Component ${index + 1}`, cardX + 22, componentTop, cardInnerWidth, componentLines[index] + 2, [
      { text: component, style: monoStyle },
    ]);
    componentTop += componentLines[index] + 8;
  });

  if (note) {
    writeText(canvas, "Components note", cardX + 22, componentTop - 8 + 14, cardInnerWidth, note.heightPx + 2, [
      { text: content.note, style: noteStyle },
    ]);
  }
}

/* -- diagram ------------------------------------------------------------- */

/** Below this the drawing stops reading on a projector; it is cropped instead. */
const DIAGRAM_MIN_HEIGHT = 90;

export interface DiagramImage {
  relId: string;
  pixelWidth: number;
  pixelHeight: number;
}

function renderDiagramSlide(
  canvas: SlideCanvas,
  content: DiagramSlideContent,
  image: DiagramImage | null,
): void {
  const { frame, palette } = canvas;
  const eyebrowBottom = writeEyebrow(canvas, content.eyebrow, palette.muted);
  const region = bodyRegion(canvas, eyebrowBottom);

  const headingStyle: TextStyle = {
    fontPx: 40,
    lineHeight: 1.12,
    family: "serif",
    bold: true,
    color: palette.ink,
  };
  const noteStyle: TextStyle = { fontPx: 14, lineHeight: 1.5, family: "sans", color: palette.muted };

  const headingWidth = Math.min(frame.width, lineLengthPx(40, 34, "serif"));
  const heading = measureText(content.heading, headingStyle, headingWidth);
  const note = content.note.trim() ? measureText(content.note, noteStyle, frame.width) : null;

  if (!image) {
    const blockHeight = heading.heightPx + (note ? BODY_GAP + note.heightPx : 0);
    const blockTop = centeredTop(region, blockHeight);

    writeText(canvas, "Heading", frame.x, blockTop, headingWidth, heading.heightPx + 6, [
      { text: content.heading, style: headingStyle },
    ]);

    if (note) {
      writeText(canvas, "Footnote", frame.x, blockTop + heading.heightPx + BODY_GAP, frame.width, note.heightPx + 2, [
        { text: content.note, style: noteStyle },
      ]);
    }

    return;
  }

  writeText(canvas, "Heading", frame.x, region.top, headingWidth, heading.heightPx + 6, [
    { text: content.heading, style: headingStyle },
  ]);

  if (note) {
    writeText(canvas, "Footnote", frame.x, region.bottom - note.heightPx, frame.width, note.heightPx + 2, [
      { text: content.note, style: noteStyle },
    ]);
  }

  const areaTop = region.top + heading.heightPx + BODY_GAP;
  const areaBottom = note ? region.bottom - note.heightPx - BODY_GAP : region.bottom;
  const areaHeight = Math.max(DIAGRAM_MIN_HEIGHT, areaBottom - areaTop);
  const scale = Math.min(frame.width / image.pixelWidth, areaHeight / image.pixelHeight);
  const width = image.pixelWidth * scale;
  const height = image.pixelHeight * scale;

  canvas.shapes.push(
    pictureXml({
      id: canvas.nextId(),
      name: "Diagram",
      x: frame.x + (frame.width - width) / 2,
      y: areaTop + (areaHeight - height) / 2,
      width,
      height,
      relId: image.relId,
    }),
  );
}

/* -- slide --------------------------------------------------------------- */

function backgroundFor(slide: Slide, palette: Palette): ShapeFill {
  if (slide.layout === "title" || slide.layout === "closing") {
    return { from: palette.titleFrom, to: palette.titleTo, angleDegrees: 122 };
  }

  return slide.layout === "technical" ? palette.darkBackground : palette.card;
}

function renderSlideBody(canvas: SlideCanvas, slide: Slide, diagramImage: DiagramImage | null): void {
  switch (slide.layout) {
    case "title":
      renderCoverSlide(canvas, slide.content, slide.content.pills);
      return;
    case "closing":
      renderCoverSlide(canvas, slide.content, null);
      return;
    case "cards":
      renderCardsSlide(canvas, slide.content);
      return;
    case "flow":
      renderFlowSlide(canvas, slide.content);
      return;
    case "rules":
      renderRulesSlide(canvas, slide.content);
      return;
    case "statement":
      renderStatementSlide(canvas, slide.content);
      return;
    case "technical":
      renderTechnicalSlide(canvas, slide.content);
      return;
    case "table":
      renderTableSlide(canvas, slide.content);
      return;
    case "diagram":
      renderDiagramSlide(canvas, slide.content, diagramImage);
      return;
  }
}

/** One `<p:sld>` part: background, the layout's shapes, then the footer. */
export function renderSlideXml(
  slide: Slide,
  deck: Deck,
  slideIndex: number,
  diagramImage: DiagramImage | null = null,
): string {
  const palette = paletteForTheme(deck.theme);
  const canvas = createCanvas(frameForLayout(slide.layout), palette);
  const isDark = slide.layout === "technical";

  renderSlideBody(canvas, slide, diagramImage);
  writeFooter(canvas, deck.footerLabel, slideIndex + 1, deck.slides.length, isDark);

  const namespaces =
    `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ` +
    `xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"`;

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<p:sld ${namespaces}><p:cSld>${slideBackgroundXml(backgroundFor(slide, palette))}` +
    `${SHAPE_TREE_OPEN}${canvas.shapes.join("")}${SHAPE_TREE_CLOSE}</p:cSld>` +
    `<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`
  );
}
