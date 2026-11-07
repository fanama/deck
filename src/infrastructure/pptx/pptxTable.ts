import type { TableSlideContent } from "../../domain/deck/slideTypes.ts";
import { escapeHtml } from "../../shared/escapeHtml.ts";
import { computeTableLayout, isNumericCell } from "../../shared/tableLayout.ts";
import { toEmu } from "./pptxUnits.ts";
import type { Palette } from "./pptxUnits.ts";

/**
 * A real PowerPoint table (`a:tbl` inside a graphic frame), not a picture of
 * one: rows, columns, fills, borders, margins and alignment all travel, so the
 * deck's table stays editable and matches the HTML grid.
 */

const CELL_MARGIN_X = 12;
const CELL_MARGIN_Y = 8;

interface CellParagraph {
  text: string;
  fontPx: number;
  family: "Arial" | "Consolas";
  color: string;
  bold?: boolean;
  caps?: boolean;
  trackingPx?: number;
  align: "l" | "r";
}

interface TableCellSpec {
  paragraphs: CellParagraph[];
  fill: string;
  borders: { left: boolean; right: boolean; top: boolean; bottom: boolean };
  borderColor: string;
  borderAlpha?: number;
  /** The label column starts at the frame edge, like the slide heading. */
  marginLeft?: number;
}

function runXml(paragraph: CellParagraph): string {
  const bold = paragraph.bold ? 1 : 0;
  const caps = paragraph.caps ? ` cap="all"` : "";
  const tracking = paragraph.trackingPx
    ? ` spc="${Math.round(paragraph.trackingPx * 75)}"`
    : "";

  return (
    `<a:r><a:rPr lang="en-US" sz="${Math.round(paragraph.fontPx * 75)}" b="${bold}"${caps}${tracking} dirty="0">` +
    `<a:solidFill><a:srgbClr val="${paragraph.color}"/></a:solidFill>` +
    `<a:latin typeface="${paragraph.family}"/></a:rPr>` +
    `<a:t>${escapeHtml(paragraph.text)}</a:t></a:r>`
  );
}

function paragraphXml(paragraph: CellParagraph): string {
  return `<a:p><a:pPr algn="${paragraph.align}"><a:buNone/></a:pPr>${runXml(paragraph)}</a:p>`;
}

function borderXml(
  tag: "lnL" | "lnR" | "lnT" | "lnB",
  color: string,
  alpha?: number,
): string {
  const fill =
    alpha === undefined
      ? `<a:srgbClr val="${color}"/>`
      : `<a:srgbClr val="${color}"><a:alpha val="${Math.round(alpha * 100000)}"/></a:srgbClr>`;

  return `<a:${tag} w="${toEmu(1)}"><a:solidFill>${fill}</a:solidFill></a:${tag}>`;
}

function noBorderXml(tag: "lnL" | "lnR" | "lnT" | "lnB"): string {
  return `<a:${tag}><a:noFill/></a:${tag}>`;
}

function cellXml(spec: TableCellSpec): string {
  const line = (tag: "lnL" | "lnR" | "lnT" | "lnB", shown: boolean): string =>
    shown ? borderXml(tag, spec.borderColor, spec.borderAlpha) : noBorderXml(tag);

  const paragraphs =
    spec.paragraphs
      .filter((paragraph) => paragraph.text.trim() !== "")
      .map(paragraphXml)
      .join("") || "<a:p/>";

  return (
    `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/>${paragraphs}</a:txBody>` +
    `<a:tcPr marL="${toEmu(spec.marginLeft ?? CELL_MARGIN_X)}" marR="${toEmu(CELL_MARGIN_X)}" ` +
    `marT="${toEmu(CELL_MARGIN_Y)}" marB="${toEmu(CELL_MARGIN_Y)}" anchor="ctr">` +
    `${line("lnL", spec.borders.left)}${line("lnR", spec.borders.right)}` +
    `${line("lnT", spec.borders.top)}${line("lnB", spec.borders.bottom)}` +
    `<a:solidFill><a:srgbClr val="${spec.fill}"/></a:solidFill></a:tcPr></a:tc>`
  );
}

/** The whole table as one graphic frame, sized from the shared layout. */
export function tableGraphicFrameXml({
  id,
  name,
  x,
  y,
  width,
  content,
  palette,
}: {
  id: number;
  name: string;
  x: number;
  y: number;
  width: number;
  content: TableSlideContent;
  palette: Palette;
}): string {
  const layout = computeTableLayout(content);
  const columnCount = content.columns.length + 1;
  const columnWidths = layout.columnShares.map((share) => toEmu(share * width));

  const headerCells = [content.rowHeader, ...content.columns];
  const headerRow =
    `<a:tr h="${toEmu(layout.headerHeight)}">` +
    headerCells
      .map((text, index) =>
        cellXml({
          paragraphs: [
            {
              text,
              fontPx: 10,
              family: "Arial",
              bold: true,
              caps: true,
              trackingPx: 1.5,
              color: palette.paper,
              align: "l",
            },
          ],
          fill: palette.ink,
          borders: { left: false, right: index < columnCount - 1, top: false, bottom: false },
          borderColor: "FFFFFF",
          borderAlpha: 0.16,
          marginLeft: index === 0 ? 0 : CELL_MARGIN_X,
        }),
      )
      .join("") +
    `</a:tr>`;

  const bodyRows = content.rows
    .map((row, rowIndex) => {
      const zebra = rowIndex % 2 === 1;
      const fill = zebra ? palette.panel : palette.card;
      const labelParagraphs: CellParagraph[] = [
        {
          text: row.label,
          fontPx: 11.5,
          family: "Consolas",
          bold: true,
          color: palette.ink,
          align: "l",
        },
      ];

      if (row.detail.trim()) {
        labelParagraphs.push({
          text: row.detail,
          fontPx: 9.5,
          family: "Arial",
          color: palette.muted,
          align: "l",
        });
      }

      const labelCell = cellXml({
        paragraphs: labelParagraphs,
        fill,
        borders: { left: false, right: content.columns.length > 0, top: true, bottom: false },
        borderColor: palette.line,
        marginLeft: 0,
      });

      const dataCells = content.columns
        .map((_column, index) => {
          const text = row.cells[index] ?? "";

          return cellXml({
            paragraphs: [
              {
                text,
                fontPx: 11.5,
                family: "Arial",
                color: palette.inkSoft,
                align: isNumericCell(text) ? "r" : "l",
              },
            ],
            fill,
            borders: {
              left: false,
              right: index < content.columns.length - 1,
              top: true,
              bottom: false,
            },
            borderColor: palette.line,
          });
        })
        .join("");

      return `<a:tr h="${toEmu(layout.rowHeight)}">${labelCell}${dataCells}</a:tr>`;
    })
    .join("");

  const height = layout.headerHeight + layout.rowHeight * content.rows.length;

  return (
    `<p:graphicFrame><p:nvGraphicFramePr>` +
    `<p:cNvPr id="${id}" name="${escapeHtml(name)}"/><p:cNvGraphicFramePr/><p:nvPr/>` +
    `</p:nvGraphicFramePr>` +
    `<p:xfrm><a:off x="${toEmu(x)}" y="${toEmu(y)}"/>` +
    `<a:ext cx="${toEmu(width)}" cy="${toEmu(height)}"/></p:xfrm>` +
    `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">` +
    `<a:tbl><a:tblPr firstRow="0" bandRow="0"/>` +
    `<a:tblGrid>${columnWidths.map((columnWidth) => `<a:gridCol w="${columnWidth}"/>`).join("")}</a:tblGrid>` +
    `${headerRow}${bodyRows}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`
  );
}
