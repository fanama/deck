import type { TableSlideContent } from "../domain/deck/slideTypes.ts";

/**
 * Table geometry shared by the preview, the HTML renderer and the PPTX
 * renderer. Nothing measures the DOM: line counts are estimated from the
 * column width and the type scale, so the three outputs cannot drift.
 */

/** The first column names what is compared; the rest carry the evidence. */
export const TABLE_LABEL_COLUMN_SHARE = 0.28;
export const TABLE_HEADER_HEIGHT = 32;
export const TABLE_ROW_PADDING_Y = 8;
export const TABLE_MIN_ROW_HEIGHT = 34;
export const TABLE_MAX_ROW_HEIGHT = 62;
export const TABLE_MAX_COLUMNS = 5;
/** The slide's content width: 1280px stage minus the 68px gutters. */
export const TABLE_BODY_WIDTH = 1144;
/** Height available to the table between the heading and the footer. */
export const TABLE_BODY_HEIGHT = 470;

const LABEL_CHAR_WIDTH = 6.9;
const DETAIL_CHAR_WIDTH = 5.5;
const CELL_CHAR_WIDTH = 6.2;
const LABEL_LINE_HEIGHT = 14.95;
const DETAIL_LINE_HEIGHT = 11.9;
const CELL_LINE_HEIGHT = 14.95;
const CELL_PADDING_X = 12;
const NOTE_HEIGHT = 21;
const NOTE_GAP = 24;

const NUMERIC_PATTERN =
  /^[+-]?(?:[$€£]\s?)?\d[\d,.\s]*(?:%|k|m|b|x|×|ms|s|px|pt|GB|MB|TB)?$/i;

/** A cell that reads as a quantity, so it can right-align like a column. */
export function isNumericCell(text: string): boolean {
  const trimmed = text.trim();

  return trimmed.length > 0 && trimmed.length <= 24 && NUMERIC_PATTERN.test(trimmed);
}

/** Label column plus one equal share per evidence column; the shares sum to 1. */
export function tableColumnShares(columnCount: number): number[] {
  const count = Math.max(0, Math.min(TABLE_MAX_COLUMNS, Math.floor(columnCount)));
  const dataShare = count > 0 ? (1 - TABLE_LABEL_COLUMN_SHARE) / count : 0;

  return [TABLE_LABEL_COLUMN_SHARE, ...Array.from({ length: count }, () => dataShare)];
}

function charsPerLine(widthPx: number, charWidth: number): number {
  return Math.max(6, Math.floor((widthPx - CELL_PADDING_X * 2) / charWidth));
}

/** Word-wrapped line count, conservative for long unbroken tokens. */
function wrappedLineCount(text: string, maxChars: number): number {
  const limit = Math.max(6, Math.floor(maxChars));
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 1;

  let lines = 1;
  let current = 0;

  for (const word of words) {
    if (current === 0) {
      current = word.length;
    } else if (current + 1 + word.length <= limit) {
      current += 1 + word.length;
    } else {
      lines += 1;
      current = word.length;
    }

    while (current > limit) {
      lines += 1;
      current -= limit;
    }
  }

  return lines;
}

export interface TableLayout {
  columnShares: number[];
  rowHeight: number;
  headerHeight: number;
  /** True when the grid needs more height than the body region has. */
  overflowsStage: boolean;
}

/**
 * One uniform row height for every data row: the tallest cell decides, capped
 * so a runaway cell cannot push the table off the stage.
 */
export function computeTableLayout(content: TableSlideContent): TableLayout {
  const columnShares = tableColumnShares(content.columns.length);
  const labelWidth = TABLE_LABEL_COLUMN_SHARE * TABLE_BODY_WIDTH;
  let tallest = TABLE_MIN_ROW_HEIGHT;

  for (const row of content.rows) {
    const labelLines = wrappedLineCount(row.label, charsPerLine(labelWidth, LABEL_CHAR_WIDTH));
    const detailLines = row.detail.trim()
      ? wrappedLineCount(row.detail, charsPerLine(labelWidth, DETAIL_CHAR_WIDTH))
      : 0;

    let rowNeed =
      TABLE_ROW_PADDING_Y * 2 + labelLines * LABEL_LINE_HEIGHT + detailLines * DETAIL_LINE_HEIGHT;

    content.columns.forEach((_column, index) => {
      const share = columnShares[index + 1] ?? 0;
      const cellLines = wrappedLineCount(
        row.cells[index] ?? "",
        charsPerLine(share * TABLE_BODY_WIDTH, CELL_CHAR_WIDTH),
      );

      rowNeed = Math.max(rowNeed, TABLE_ROW_PADDING_Y * 2 + cellLines * CELL_LINE_HEIGHT);
    });

    tallest = Math.max(tallest, rowNeed);
  }

  const rowHeight = Math.min(TABLE_MAX_ROW_HEIGHT, Math.ceil(tallest));
  const noteHeight = content.note.trim() ? NOTE_HEIGHT + NOTE_GAP : 0;

  return {
    columnShares,
    rowHeight,
    headerHeight: TABLE_HEADER_HEIGHT,
    overflowsStage:
      TABLE_HEADER_HEIGHT + rowHeight * content.rows.length + noteHeight > TABLE_BODY_HEIGHT,
  };
}
