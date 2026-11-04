import { slideShellClassForLayout } from "../../domain/deck/slideLayoutCatalog.ts";
import type {
  CardsSlideContent,
  ClosingSlideContent,
  FlowLane,
  FlowSlideContent,
  MetaRow,
  RulesSlideContent,
  Slide,
  StatementSlideContent,
  TechnicalSlideContent,
  TitleSlideContent,
} from "../../domain/deck/slideTypes.ts";
import { escapeHtml } from "../../shared/escapeHtml.ts";

function renderEyebrow(eyebrow: string): string {
  return `      <div class="eyebrow">${escapeHtml(eyebrow)}</div>`;
}

function renderPills(pills: string[]): string {
  if (pills.length === 0) return "";
  const pillsHtml = pills.map((pill) => `<span class="pill">${escapeHtml(pill)}</span>`).join("");
  return `          <div class="pills" style="margin-top:26px;">${pillsHtml}</div>`;
}

function renderMetaRows(metaRows: MetaRow[]): string {
  if (metaRows.length === 0) return "";
  const rowsHtml = metaRows
    .map((row) => `            <div><dt>${escapeHtml(row.label)}</dt><dd>${escapeHtml(row.value)}</dd></div>`)
    .join("\n");

  return `        <dl class="kv">\n${rowsHtml}\n        </dl>`;
}

function renderPoints(points: string[]): string {
  const pointsHtml = points.map((point) => `            <li>${escapeHtml(point)}</li>`).join("\n");
  return `          <ul class="clean">\n${pointsHtml}\n          </ul>`;
}

function renderFootnote(note: string): string {
  return note ? `        <p class="note">${escapeHtml(note)}</p>` : "";
}

function renderTitleSlideBody(content: TitleSlideContent): string {
  return [
    renderEyebrow(content.eyebrow),
    `      <div class="title-grid" style="flex:1; align-items:center;">`,
    `        <div>`,
    `          <h1>${escapeHtml(content.heading)}</h1>`,
    `          <p class="lede">${escapeHtml(content.lede)}</p>`,
    renderPills(content.pills),
    `        </div>`,
    renderMetaRows(content.meta),
    `      </div>`,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function renderClosingSlideBody(content: ClosingSlideContent): string {
  return [
    renderEyebrow(content.eyebrow),
    `      <div class="title-grid" style="flex:1; align-items:center;">`,
    `        <div>`,
    `          <h1>${escapeHtml(content.heading)}</h1>`,
    `          <p class="lede">${escapeHtml(content.lede)}</p>`,
    `        </div>`,
    renderMetaRows(content.meta),
    `      </div>`,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function renderCardsSlideBody(content: CardsSlideContent): string {
  const columnCount = Math.min(4, Math.max(1, content.cards.length));

  const cardsHtml = content.cards
    .map(
      (card) => `            <div class="card">
              <span class="num">${escapeHtml(card.marker)}</span>
              <h3>${escapeHtml(card.title)}</h3>
              <p>${escapeHtml(card.body)}</p>
            </div>`,
    )
    .join("\n");

  return [
    renderEyebrow(content.eyebrow),
    `      <div class="body">`,
    `        <h2>${escapeHtml(content.heading)}</h2>`,
    `        <div class="cols" style="--columns:${columnCount}">`,
    cardsHtml,
    `        </div>`,
    renderFootnote(content.note),
    `      </div>`,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function renderLanes(lanes: FlowLane[]): string {
  return lanes
    .map((lane) => {
      const nodesHtml = lane.nodes
        .map((node, nodeIndex) => {
          const arrow = nodeIndex > 0 ? `<div class="arrow">→</div>` : "";
          return `${arrow}<div class="node"><strong>${escapeHtml(node.title)}</strong><span>${escapeHtml(node.detail)}</span></div>`;
        })
        .join("");

      return `            <div class="lane">
              <div class="lane-label">${escapeHtml(lane.label)}</div>
              <div class="row">${nodesHtml}</div>
            </div>`;
    })
    .join("\n");
}

function renderFlowSlideBody(content: FlowSlideContent): string {
  return [
    renderEyebrow(content.eyebrow),
    `      <div class="body">`,
    `        <h2>${escapeHtml(content.heading)}</h2>`,
    `        <div class="lanes">`,
    renderLanes(content.lanes),
    `        </div>`,
    renderFootnote(content.note),
    `      </div>`,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function renderRulesSlideBody(content: RulesSlideContent): string {
  const rulesHtml = content.rules
    .map(
      (rule) => `            <div class="rule">
              <div class="k">${escapeHtml(rule.marker)}</div>
              <p>${escapeHtml(rule.statement)}</p>
            </div>`,
    )
    .join("\n");

  return [
    renderEyebrow(content.eyebrow),
    `      <div class="body">`,
    `        <h2>${escapeHtml(content.heading)}</h2>`,
    `        <div class="rules">`,
    rulesHtml,
    `        </div>`,
    renderFootnote(content.note),
    `      </div>`,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function renderStatementSlideBody(content: StatementSlideContent): string {
  return [
    renderEyebrow(content.eyebrow),
    `      <div class="body">`,
    `        <h2>${escapeHtml(content.heading)}</h2>`,
    `        <div class="cols" style="--columns:2; gap:48px; align-items:center;">`,
    renderPoints(content.points),
    `          <div class="card" style="padding:24px;">
            <div class="stat">${escapeHtml(content.figure)}<small>${escapeHtml(content.figureCaption)}</small></div>
          </div>`,
    `        </div>`,
    `      </div>`,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function renderTechnicalSlideBody(content: TechnicalSlideContent): string {
  const componentsHtml = content.components
    .map((component) => `<span class="mono">${escapeHtml(component)}</span>`)
    .join("\n              ");

  return [
    renderEyebrow(content.eyebrow),
    `      <div class="body">`,
    `        <h2>${escapeHtml(content.heading)}</h2>`,
    `        <div class="cols" style="--columns:2; gap:36px; align-items:start;">`,
    renderPoints(content.points),
    `          <div class="card" style="padding:22px;">
            <h3>${escapeHtml(content.componentsTitle)}</h3>
            <div class="mono-list">
              ${componentsHtml}
            </div>
            ${content.note ? `<p class="note" style="margin-top:14px;">${escapeHtml(content.note)}</p>` : ""}
          </div>`,
    `        </div>`,
    `      </div>`,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function renderSlideBody(slide: Slide): string {
  switch (slide.layout) {
    case "title":
      return renderTitleSlideBody(slide.content);
    case "cards":
      return renderCardsSlideBody(slide.content);
    case "flow":
      return renderFlowSlideBody(slide.content);
    case "rules":
      return renderRulesSlideBody(slide.content);
    case "statement":
      return renderStatementSlideBody(slide.content);
    case "technical":
      return renderTechnicalSlideBody(slide.content);
    case "closing":
      return renderClosingSlideBody(slide.content);
  }
}

export interface RenderSlideSectionInput {
  slide: Slide;
  slideNumber: number;
  totalSlides: number;
  footerLabel: string;
  isActive: boolean;
}

/** One section of the exported document, mirroring the preview component. */
export function renderSlideSectionHtml({
  slide,
  slideNumber,
  totalSlides,
  footerLabel,
  isActive,
}: RenderSlideSectionInput): string {
  const activeClass = isActive ? " active" : "";

  return `    <section class="${slideShellClassForLayout(slide.layout)}${activeClass}">
${renderSlideBody(slide)}
      <div class="footer"><span>${escapeHtml(footerLabel)}</span><span>${slideNumber} / ${totalSlides}</span></div>
    </section>`;
}
