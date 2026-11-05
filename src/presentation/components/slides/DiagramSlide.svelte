<script lang="ts">
  import { getContext, tick } from "svelte";
  import type {
    DiagramBox,
    DiagramLink,
    DiagramSlideContent,
  } from "../../../domain/deck/slideTypes.ts";
  import type { DiagramAnchorSide, DiagramArrow, DiagramBoxStyle } from "../../../shared/diagramSvg.ts";
  import {
    DIAGRAM_ANCHOR_SIDES,
    DIAGRAM_COLORS,
    diagramAnchor,
    diagramBoxStyle,
    DIAGRAM_HEIGHT,
    DIAGRAM_LABEL_LINE_HEIGHT,
    DIAGRAM_WIDTH,
    diagramArrow,
    diagramLabelLines,
    diagramShapePath,
    diagramShapeSize,
    normalizeDiagramBoxes,
    normalizeDiagramLinks,
    normalizeDiagramRouting,
  } from "../../../shared/diagramSvg.ts";
  import EditableText from "../EditableText.svelte";
  import { SLIDE_TEXT_EDITING } from "../slideTextEditing.ts";
  import type { SlideTextEditing } from "../slideTextEditing.ts";

  let {
    content,
    accent,
    onMoveBox,
  }: {
    content: DiagramSlideContent;
    /** The deck accent, so the drawing follows the theme outside the studio. */
    accent: string;
    /** Provided by the studio only: the exported deck has nothing to drag. */
    onMoveBox?: (index: number, position: { x: number; y: number }) => void;
  } = $props();

  const colors = $derived({ ...DIAGRAM_COLORS, accent });
  const boxes = $derived(normalizeDiagramBoxes(content.boxes));
  const links = $derived(normalizeDiagramLinks(content.links, boxes));
  const routing = $derived(normalizeDiagramRouting(content.routing));

  // Linking and renaming reuse the in-place text channel, so they exist exactly
  // where text editing does: the studio preview, never the export.
  const textEditing = getContext<SlideTextEditing | undefined>(SLIDE_TEXT_EDITING);
  const canEdit = $derived(textEditing?.canEdit() === true);

  interface LabelEditor {
    index: number;
    left: number;
    top: number;
    width: number;
    height: number;
    fontSize: number;
  }

  interface LinkDrag {
    fromId: string;
    startX: number;
    startY: number;
    x: number;
    y: number;
  }

  let diagramElement = $state<HTMLDivElement | undefined>(undefined);
  let svgElement = $state<SVGSVGElement | undefined>(undefined);
  let labelEditor = $state<LabelEditor | null>(null);
  let draft = $state("");
  let labelInput = $state<HTMLInputElement | undefined>(undefined);
  let linkDrag = $state<LinkDrag | null>(null);
  let pendingLinkFrom = $state<string | null>(null);

  let drag = $state<{ index: number; offsetX: number; offsetY: number; x: number; y: number } | null>(
    null,
  );

  /** While dragging, draw the box where the pointer is, not where it is stored. */
  const laidOut = $derived.by(() => {
    const active = drag;
    if (!active) return boxes;

    return boxes.map((box, index) => (index === active.index ? { ...box, x: active.x, y: active.y } : box));
  });

  const arrows = $derived.by(() => {
    const boxesById = new Map(laidOut.map((box) => [box.id, box]));

    return links
      .map((link) => {
        const from = boxesById.get(link.from);
        const to = boxesById.get(link.to);
        if (!from || !to) return null;

        return { link, arrow: diagramArrow(from, to, routing), key: `${link.from}->${link.to}` };
      })
      .filter((entry): entry is { link: DiagramLink; arrow: DiagramArrow; key: string } => entry !== null);
  });

  function clamp(value: number, max: number): number {
    return Math.min(Math.max(value, 0), max);
  }

  /** Pointer position in the SVG's own 1000×440 units, whatever the zoom. */
  function pointInDiagram(event: PointerEvent): { x: number; y: number } | null {
    const matrix = svgElement?.getScreenCTM();
    if (!matrix) return null;

    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
  }

  function boxAt(x: number, y: number): DiagramBox | undefined {
    return laidOut.find((box) => {
      const size = diagramShapeSize(box.shape);

      return x >= box.x && x <= box.x + size.width && y >= box.y && y <= box.y + size.height;
    });
  }

  function startDrag(event: PointerEvent, index: number): void {
    if (!onMoveBox) return;

    const box = boxes[index];
    const point = pointInDiagram(event);
    if (!box || !point) return;

    drag = { index, offsetX: point.x - box.x, offsetY: point.y - box.y, x: box.x, y: box.y };
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function moveDrag(event: PointerEvent): void {
    if (!drag) return;

    const point = pointInDiagram(event);
    if (!point) return;

    const size = diagramShapeSize(boxes[drag.index]?.shape);

    drag = {
      ...drag,
      x: clamp(point.x - drag.offsetX, DIAGRAM_WIDTH - size.width),
      y: clamp(point.y - drag.offsetY, DIAGRAM_HEIGHT - size.height),
    };
  }

  function endDrag(event: PointerEvent): void {
    const finished = drag;
    if (!finished) return;

    drag = null;

    const target = event.currentTarget as Element;
    if (target.hasPointerCapture?.(event.pointerId)) target.releasePointerCapture(event.pointerId);

    const position = { x: Math.round(finished.x), y: Math.round(finished.y) };
    const box = boxes[finished.index];

    // A click without movement must not count as a move and trigger an autosave.
    if (!box || (box.x === position.x && box.y === position.y)) return;
    onMoveBox?.(finished.index, position);
  }

  /** Arrow keys nudge a focused box; shift makes the step fine. */
  function nudge(event: KeyboardEvent, index: number): void {
    if (!onMoveBox) return;

    const step = event.shiftKey ? 1 : 10;
    const deltas: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const delta = deltas[event.key];
    const box = boxes[index];
    if (!delta || !box) return;

    const size = diagramShapeSize(box.shape);

    event.preventDefault();
    onMoveBox(index, {
      x: Math.round(clamp(box.x + delta[0], DIAGRAM_WIDTH - size.width)),
      y: Math.round(clamp(box.y + delta[1], DIAGRAM_HEIGHT - size.height)),
    });
  }

  /** A pending connector turns Enter on a box into "link to this one". */
  function handleBoxKeydown(event: KeyboardEvent, index: number, box: DiagramBox): void {
    if (pendingLinkFrom && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      linkTo(box.id);
      return;
    }

    if (pendingLinkFrom && event.key === "Escape") {
      event.preventDefault();
      pendingLinkFrom = null;
      return;
    }

    nudge(event, index);
  }

  function handleConnectorKeydown(event: KeyboardEvent, box: DiagramBox): void {
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    pendingLinkFrom = pendingLinkFrom === box.id ? null : box.id;
  }

  function startLink(event: PointerEvent, box: DiagramBox, side: DiagramAnchorSide): void {
    if (!canEdit) return;

    const point = pointInDiagram(event);
    if (!point) return;

    const anchor = diagramAnchor(box, side);

    event.preventDefault();
    event.stopPropagation();

    pendingLinkFrom = null;
    linkDrag = {
      fromId: box.id,
      startX: anchor.x,
      startY: anchor.y,
      x: point.x,
      y: point.y,
    };
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
  }

  function moveLink(event: PointerEvent): void {
    if (!linkDrag) return;

    const point = pointInDiagram(event);
    if (!point) return;

    linkDrag = { ...linkDrag, x: point.x, y: point.y };
  }

  function finishLink(event: PointerEvent): void {
    const finished = linkDrag;
    if (!finished) return;

    linkDrag = null;

    const target = event.currentTarget as Element;
    if (target.hasPointerCapture?.(event.pointerId)) target.releasePointerCapture(event.pointerId);

    const point = pointInDiagram(event);
    if (!point) return;

    const destination = boxAt(point.x, point.y);
    if (!destination || destination.id === finished.fromId) return;
    if (links.some((link) => link.from === finished.fromId && link.to === destination.id)) return;

    textEditing?.commit(["links"], [...links, { from: finished.fromId, to: destination.id }]);
  }

  function cancelLink(event: PointerEvent): void {
    linkDrag = null;

    const target = event.currentTarget as Element;
    if (target.hasPointerCapture?.(event.pointerId)) target.releasePointerCapture(event.pointerId);
  }

  function linkTo(toId: string): void {
    const fromId = pendingLinkFrom;
    pendingLinkFrom = null;

    if (!fromId || fromId === toId) return;
    if (links.some((link) => link.from === fromId && link.to === toId)) return;

    textEditing?.commit(["links"], [...links, { from: fromId, to: toId }]);
  }

  function removeLink(link: DiagramLink): void {
    textEditing?.commit(
      ["links"],
      links.filter((candidate) => candidate.from !== link.from || candidate.to !== link.to),
    );
  }

  function handleLinkKeydown(event: KeyboardEvent, link: DiagramLink): void {
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    removeLink(link);
  }

  /**
   * Double-click opens an `<input>` exactly over the shape. SVG text cannot be
   * edited in place, so the field is measured from the rendered group and laid
   * out in the preview's own (unscaled) pixels.
   */
  function openLabelEditor(event: MouseEvent, index: number): void {
    const container = diagramElement;
    const box = boxes[index];
    if (!canEdit || !container || !box) return;

    event.preventDefault();
    event.stopPropagation();

    const boxRect = (event.currentTarget as SVGGElement).getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const zoom = containerRect.width / (container.offsetWidth || 1);
    if (!boxRect || zoom <= 0) return;

    const localWidth = boxRect.width / zoom;
    const unitScale = localWidth / diagramShapeSize(box.shape).width;

    labelEditor = {
      index,
      left: (boxRect.left - containerRect.left) / zoom,
      top: (boxRect.top - containerRect.top) / zoom,
      width: localWidth,
      height: boxRect.height / zoom,
      fontSize: 16 * unitScale,
    };
    draft = box.label;

    void tick().then(() => {
      labelInput?.focus();
      labelInput?.select();
    });
  }

  function commitLabel(): void {
    const editor = labelEditor;
    if (!editor) return;

    labelEditor = null;

    const box = boxes[editor.index];
    const next = draft.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

    if (box && next !== box.label) textEditing?.commit(["boxes", editor.index, "label"], next);
  }

  function handleLabelKeydown(event: KeyboardEvent): void {
    if (event.key === "Enter") {
      event.preventDefault();
      commitLabel();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      labelEditor = null;
    }
  }
</script>

{#snippet boxShape(box: DiagramBox, lines: string[], firstLineY: number, style: DiagramBoxStyle)}
  <path d={diagramShapePath(box)} fill={style.fill} stroke={style.stroke} stroke-width="2" />
  {#each lines as line, lineIndex (lineIndex)}
    <text
      x={box.x + diagramShapeSize(box.shape).width / 2}
      y={firstLineY + lineIndex * DIAGRAM_LABEL_LINE_HEIGHT}
      text-anchor="middle"
      font-family="Georgia, serif"
      font-size="16"
      fill={style.text}>{line}</text>
  {/each}
{/snippet}

<EditableText as="div" class="eyebrow" path={["eyebrow"]} value={content.eyebrow} />

<div class="body">
  <EditableText as="h2" path={["heading"]} value={content.heading} />

  {#if boxes.length === 0}
    <p class="note">Add a box in the inspector.</p>
  {:else}
    <div class="diagram" class:is-editable={onMoveBox !== undefined} bind:this={diagramElement}>
      <svg
        bind:this={svgElement}
        viewBox="0 0 {DIAGRAM_WIDTH} {DIAGRAM_HEIGHT}"
        role="img"
        aria-label={content.heading}
      >
        {#each arrows as entry (entry.key)}
          <polyline
            points={entry.arrow.points}
            fill="none"
            stroke={colors.accent}
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <polygon points={entry.arrow.headPoints} fill={colors.accent} />

          {#if canEdit}
            <polyline
              class="diagram-link-hit"
              points={entry.arrow.points}
              fill="none"
              stroke="transparent"
              stroke-width="18"
              role="button"
              tabindex="0"
              aria-label="Remove this arrow"
              onclick={() => removeLink(entry.link)}
              onkeydown={(event) => handleLinkKeydown(event, entry.link)}
            >
              <title>Click to remove this arrow</title>
            </polyline>
          {/if}
        {/each}

        {#each laidOut as box, index (box.id)}
          {@const size = diagramShapeSize(box.shape)}
          {@const labelLines = diagramLabelLines(box)}
          {@const boxStyle = diagramBoxStyle(colors, box.tone)}
          {@const firstLineY =
            box.y + size.height / 2 - ((labelLines.length - 1) * DIAGRAM_LABEL_LINE_HEIGHT) / 2 + 5}

          {#if onMoveBox}
            <g
              class="diagram-box"
              class:is-dragging={drag?.index === index}
              class:is-link-target={pendingLinkFrom !== null && pendingLinkFrom !== box.id}
              role="button"
              tabindex="0"
              aria-label={`Move ${box.label || `box ${index + 1}`}`}
              ondblclick={(event) => openLabelEditor(event, index)}
              onclick={() => pendingLinkFrom && linkTo(box.id)}
              onpointerdown={(event) => startDrag(event, index)}
              onpointermove={moveDrag}
              onpointerup={endDrag}
              onpointercancel={endDrag}
              onkeydown={(event) => handleBoxKeydown(event, index, box)}
            >
              <title>Drag to move, double-click to rename</title>
              {@render boxShape(box, labelLines, firstLineY, boxStyle)}
            </g>
          {:else}
            <g class="diagram-box">
              {@render boxShape(box, labelLines, firstLineY, boxStyle)}
            </g>
          {/if}
        {/each}

        {#if linkDrag}
          <line
            x1={linkDrag.startX}
            y1={linkDrag.startY}
            x2={linkDrag.x}
            y2={linkDrag.y}
            stroke={colors.accent}
            stroke-width="2"
            stroke-dasharray="6 5"
            stroke-linecap="round"
          />
        {/if}

        {#if canEdit}
          {#each laidOut as box (box.id)}
            {#each DIAGRAM_ANCHOR_SIDES as side (side)}
              {@const anchor = diagramAnchor(box, side)}

              <g
                class="diagram-connector"
                class:is-pending={pendingLinkFrom === box.id}
                role="button"
                tabindex="0"
                aria-label={`Start a link from the ${side} side of ${box.label || "this box"}`}
                onpointerdown={(event) => startLink(event, box, side)}
                onpointermove={moveLink}
                onpointerup={finishLink}
                onpointercancel={cancelLink}
                onkeydown={(event) => handleConnectorKeydown(event, box)}
              >
                <title>Drag to another box to link</title>
                <circle
                  cx={anchor.x}
                  cy={anchor.y}
                  r="7"
                  fill={colors.accent}
                  stroke={colors.paper}
                  stroke-width="2"
                />
              </g>
            {/each}
          {/each}
        {/if}
      </svg>

      {#if labelEditor}
        {@const renameStyle = diagramBoxStyle(colors, boxes[labelEditor.index]?.tone)}

        <input
          bind:this={labelInput}
          class="diagram-label-input"
          style="left: {labelEditor.left}px; top: {labelEditor.top}px; width: {labelEditor.width}px; height: {labelEditor.height}px; font-size: {labelEditor.fontSize}px; color: {renameStyle.text}; border-color: {renameStyle.stroke};"
          maxlength="40"
          value={draft}
          aria-label="Diagram box label"
          oninput={(event) => (draft = event.currentTarget.value)}
          onkeydown={handleLabelKeydown}
          onblur={commitLabel}
        />
      {/if}
    </div>
  {/if}

  {#if content.note}
    <EditableText as="p" class="note" path={["note"]} value={content.note} />
  {/if}
</div>
