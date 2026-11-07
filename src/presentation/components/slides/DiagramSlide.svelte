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
    DIAGRAM_HEIGHT,
    DIAGRAM_LABEL_LINE_HEIGHT,
    DIAGRAM_WIDTH,
    diagramAnchor,
    diagramArrow,
    diagramBoxAtPoint,
    diagramBoxMinSize,
    diagramBoxStyle,
    diagramContainerIds,
    diagramLabelLines,
    diagramMoveIds,
    diagramRenderOrder,
    diagramShapePath,
    diagramShapeSize,
    normalizeDiagramBoxes,
    normalizeDiagramLinks,
    normalizeDiagramRouting,
    schemaNodeLayout,
  } from "../../../shared/diagramSvg.ts";
  import EditableText from "../EditableText.svelte";
  import { SLIDE_TEXT_EDITING } from "../slideTextEditing.ts";
  import type { SlideTextEditing } from "../slideTextEditing.ts";

  let {
    content,
    accent,
    onMoveBoxes,
    selectedBoxId,
    selectedBoxIds,
    onSelectBox,
    onResizeBox,
  }: {
    content: DiagramSlideContent;
    /** The deck accent, so the drawing follows the theme outside the studio. */
    accent: string;
    /** Provided by the studio only: the exported deck has nothing to drag. */
    onMoveBoxes?: (
      updates: ReadonlyArray<{ index: number; x: number; y: number }>,
      nest?: { boxId: string; parentId: string | null },
    ) => void;
    selectedBoxId?: string | null;
    selectedBoxIds?: string[];
    onSelectBox?: (boxId: string | null, additive?: boolean) => void;
    onResizeBox?: (
      index: number,
      rect: { x: number; y: number; width: number; height: number },
    ) => void;
  } = $props();

  const colors = $derived({ ...DIAGRAM_COLORS, accent });
  const boxes = $derived(normalizeDiagramBoxes(content.boxes));
  const links = $derived(normalizeDiagramLinks(content.links, boxes));
  const routing = $derived(normalizeDiagramRouting(content.routing));
  const selectedIds = $derived(
    selectedBoxIds && selectedBoxIds.length > 0
      ? selectedBoxIds
      : selectedBoxId
        ? [selectedBoxId]
        : [],
  );

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
    align: "left" | "center";
  }

  interface LinkDrag {
    fromId: string;
    startX: number;
    startY: number;
    x: number;
    y: number;
  }

  type ResizeCornerId = "nw" | "ne" | "sw" | "se";

  interface ResizeCornerDefinition {
    id: ResizeCornerId;
    x: 0 | 1;
    y: 0 | 1;
    cursor: string;
  }

  const RESIZE_CORNERS: ResizeCornerDefinition[] = [
    { id: "nw", x: 0, y: 0, cursor: "nwse-resize" },
    { id: "ne", x: 1, y: 0, cursor: "nesw-resize" },
    { id: "sw", x: 0, y: 1, cursor: "nesw-resize" },
    { id: "se", x: 1, y: 1, cursor: "nwse-resize" },
  ];

  const DIAGRAM_ZOOM_MIN = 1;
  const DIAGRAM_ZOOM_MAX = 3;
  const DIAGRAM_ZOOM_STEP = 0.25;

  interface ResizeState {
    index: number;
    corner: ResizeCornerId;
    origin: { x: number; y: number; width: number; height: number };
    rect: { x: number; y: number; width: number; height: number };
  }

  let diagramElement = $state<HTMLDivElement | undefined>(undefined);
  let svgElement = $state<SVGSVGElement | undefined>(undefined);
  let labelEditor = $state<LabelEditor | null>(null);
  let draft = $state("");
  let labelInput = $state<HTMLInputElement | undefined>(undefined);
  let linkDrag = $state<LinkDrag | null>(null);
  let pendingLinkFrom = $state<string | null>(null);

  let drag = $state<{
    primaryIndex: number;
    offsetX: number;
    offsetY: number;
    dx: number;
    dy: number;
    origins: Array<{ index: number; x: number; y: number }>;
    ids: string[];
  } | null>(null);
  let resize = $state<ResizeState | null>(null);

  // Zoom is a studio view, so it stays out of the deck and the exports.
  let zoom = $state(1);
  let viewCenter = $state({ x: DIAGRAM_WIDTH / 2, y: DIAGRAM_HEIGHT / 2 });
  let pan = $state<{
    startX: number;
    startY: number;
    centerX: number;
    centerY: number;
    moved: boolean;
  } | null>(null);
  let suppressCanvasClick = false;

  const diagramViewBox = $derived.by(() => {
    const width = DIAGRAM_WIDTH / zoom;
    const height = DIAGRAM_HEIGHT / zoom;

    return `${viewCenter.x - width / 2} ${viewCenter.y - height / 2} ${width} ${height}`;
  });

  /** While dragging or resizing, draw every moved box where the pointer is. */
  const laidOut = $derived.by(() => {
    const activeDrag = drag;
    if (activeDrag) {
      const origins = new Map(activeDrag.origins.map((origin) => [origin.index, origin]));

      return boxes.map((box, index) => {
        const origin = origins.get(index);
        return origin ? { ...box, x: origin.x + activeDrag.dx, y: origin.y + activeDrag.dy } : box;
      });
    }

    const activeResize = resize;
    if (activeResize) {
      return boxes.map((box, index) =>
        index === activeResize.index ? { ...box, ...activeResize.rect } : box,
      );
    }

    return boxes;
  });

  /** Parents paint before children, so nested boxes sit on top. */
  const renderBoxes = $derived(
    diagramRenderOrder(laidOut).map((box) => ({ box, index: laidOut.indexOf(box) })),
  );
  const containerIds = $derived(diagramContainerIds(laidOut));

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

  /** Pointer position in the SVG's own 1000×440 units, whatever the zoom. */
  function pointInDiagram(event: PointerEvent): { x: number; y: number } | null {
    const matrix = svgElement?.getScreenCTM();
    if (!matrix) return null;

    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
  }

  function boxAt(x: number, y: number, excludeIds?: ReadonlySet<string>): DiagramBox | undefined {
    return diagramBoxAtPoint(laidOut, x, y, excludeIds);
  }

  /** Keeps the visible slice inside the 1000×440 drawing at every zoom. */
  function clampViewCenter(x: number, y: number, level: number): { x: number; y: number } {
    const halfWidth = DIAGRAM_WIDTH / (2 * level);
    const halfHeight = DIAGRAM_HEIGHT / (2 * level);

    return {
      x: Math.min(Math.max(x, halfWidth), DIAGRAM_WIDTH - halfWidth),
      y: Math.min(Math.max(y, halfHeight), DIAGRAM_HEIGHT - halfHeight),
    };
  }

  function setDiagramZoom(next: number): void {
    const level =
      Math.round(
        Math.min(DIAGRAM_ZOOM_MAX, Math.max(DIAGRAM_ZOOM_MIN, next)) * 100,
      ) / 100;

    zoom = level;
    viewCenter = clampViewCenter(viewCenter.x, viewCenter.y, level);
  }

  function resetDiagramZoom(): void {
    zoom = DIAGRAM_ZOOM_MIN;
    viewCenter = { x: DIAGRAM_WIDTH / 2, y: DIAGRAM_HEIGHT / 2 };
  }

  function startPan(event: PointerEvent): void {
    if (!onMoveBoxes || zoom <= DIAGRAM_ZOOM_MIN || event.button !== 0) return;

    const point = pointInDiagram(event);
    if (!point) return;

    suppressCanvasClick = false;
    pan = {
      startX: point.x,
      startY: point.y,
      centerX: viewCenter.x,
      centerY: viewCenter.y,
      moved: false,
    };
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function movePan(event: PointerEvent): void {
    if (!pan) return;

    const point = pointInDiagram(event);
    if (!point) return;

    const dx = point.x - pan.startX;
    const dy = point.y - pan.startY;

    if (!pan.moved && Math.hypot(dx, dy) > 2) pan = { ...pan, moved: true };
    viewCenter = clampViewCenter(pan.centerX - dx, pan.centerY - dy, zoom);
  }

  function endPan(event: PointerEvent): void {
    const finished = pan;
    if (!finished) return;

    const target = event.currentTarget as Element;
    if (target.hasPointerCapture?.(event.pointerId)) target.releasePointerCapture(event.pointerId);

    pan = null;

    if (finished.moved) {
      suppressCanvasClick = true;
      setTimeout(() => (suppressCanvasClick = false), 0);
    }
  }

  function handleCanvasClick(): void {
    if (suppressCanvasClick) {
      suppressCanvasClick = false;
      return;
    }

    onSelectBox?.(null);
  }

  /** Keeps every box in a drag on the drawing, without squeezing their gaps. */
  function clampedDelta(
    origins: ReadonlyArray<{ index: number; x: number; y: number }>,
    dx: number,
    dy: number,
  ): { dx: number; dy: number } {
    let minX = Number.NEGATIVE_INFINITY;
    let maxX = Number.POSITIVE_INFINITY;
    let minY = Number.NEGATIVE_INFINITY;
    let maxY = Number.POSITIVE_INFINITY;

    for (const origin of origins) {
      const size = diagramShapeSize(boxes[origin.index]);
      minX = Math.max(minX, -origin.x);
      maxX = Math.min(maxX, DIAGRAM_WIDTH - origin.x - size.width);
      minY = Math.max(minY, -origin.y);
      maxY = Math.min(maxY, DIAGRAM_HEIGHT - origin.y - size.height);
    }

    return {
      dx: Math.min(Math.max(dx, minX), maxX),
      dy: Math.min(Math.max(dy, minY), maxY),
    };
  }

  function startDrag(event: PointerEvent, index: number): void {
    if (!onMoveBoxes) return;

    const box = boxes[index];
    const point = pointInDiagram(event);
    if (!box || !point) return;

    const additive = event.shiftKey || event.metaKey || event.ctrlKey;
    const seeds = additive ? [...new Set([...selectedIds, box.id])] : [box.id];
    const movingIds = diagramMoveIds(boxes, seeds);
    const origins = boxes
      .map((candidate, candidateIndex) => ({
        index: candidateIndex,
        x: candidate.x,
        y: candidate.y,
      }))
      .filter((origin) => movingIds.has(boxes[origin.index]?.id ?? ""));

    drag = {
      primaryIndex: index,
      offsetX: point.x - box.x,
      offsetY: point.y - box.y,
      dx: 0,
      dy: 0,
      origins,
      ids: [...movingIds],
    };
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function moveDrag(event: PointerEvent): void {
    if (!drag) return;

    const point = pointInDiagram(event);
    const primary = boxes[drag.primaryIndex];
    if (!point || !primary) return;

    const delta = clampedDelta(
      drag.origins,
      point.x - drag.offsetX - primary.x,
      point.y - drag.offsetY - primary.y,
    );

    drag = { ...drag, dx: delta.dx, dy: delta.dy };
  }

  function endDrag(event: PointerEvent): void {
    const finished = drag;
    if (!finished) return;

    const target = event.currentTarget as Element;
    if (target.hasPointerCapture?.(event.pointerId)) target.releasePointerCapture(event.pointerId);

    const primary = boxes[finished.primaryIndex];
    const point = pointInDiagram(event);

    const updates = finished.origins.map((origin) => ({
      index: origin.index,
      x: Math.round(origin.x + finished.dx),
      y: Math.round(origin.y + finished.dy),
    }));

    const moved = updates.some((update) => {
      const box = boxes[update.index];
      return box && (box.x !== update.x || box.y !== update.y);
    });

    // A single box dropped on another nests; dropping it on the canvas unnests.
    // A click without movement never changes a parent, even where boxes overlap.
    const nest =
      moved && primary && point && finished.ids.length === 1
        ? {
            boxId: primary.id,
            parentId: boxAt(point.x, point.y, new Set(finished.ids))?.id ?? null,
          }
        : undefined;

    drag = null;

    const parentChanged =
      nest !== undefined && primary !== undefined && (primary.parentId ?? null) !== nest.parentId;

    // A click without movement must not count as a move and trigger an autosave.
    if (!moved && !parentChanged) return;
    onMoveBoxes?.(updates, nest);
  }

  /** A corner drag keeps the opposite corner fixed; sizes are free. */
  function startResize(event: PointerEvent, index: number, corner: ResizeCornerId): void {
    if (!onResizeBox) return;

    const box = laidOut[index];
    const point = pointInDiagram(event);
    if (!box || !point) return;

    const size = diagramShapeSize(box);

    event.preventDefault();
    event.stopPropagation();

    onSelectBox?.(box.id);
    resize = {
      index,
      corner,
      origin: { x: box.x, y: box.y, width: size.width, height: size.height },
      rect: { x: box.x, y: box.y, width: size.width, height: size.height },
    };
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
  }

  function moveResize(event: PointerEvent): void {
    const active = resize;
    if (!active) return;

    const point = pointInDiagram(event);
    const box = boxes[active.index];
    if (!point || !box) return;

    const { origin, corner } = active;
    const growsRight = corner === "ne" || corner === "se";
    const growsDown = corner === "sw" || corner === "se";
    const anchorX = growsRight ? origin.x : origin.x + origin.width;
    const anchorY = growsDown ? origin.y : origin.y + origin.height;
    const minimum = diagramBoxMinSize(box);

    let width = growsRight ? point.x - anchorX : anchorX - point.x;
    let height = growsDown ? point.y - anchorY : anchorY - point.y;

    width = Math.max(Math.round(width), minimum.width);
    height = Math.max(Math.round(height), minimum.height);
    width = Math.min(width, growsRight ? DIAGRAM_WIDTH - anchorX : anchorX);
    height = Math.min(height, growsDown ? DIAGRAM_HEIGHT - anchorY : anchorY);

    resize = {
      ...active,
      rect: {
        x: growsRight ? anchorX : anchorX - width,
        y: growsDown ? anchorY : anchorY - height,
        width,
        height,
      },
    };
  }

  function endResize(event: PointerEvent): void {
    const active = resize;
    if (!active) return;

    resize = null;

    const target = event.currentTarget as Element;
    if (target.hasPointerCapture?.(event.pointerId)) target.releasePointerCapture(event.pointerId);

    const box = boxes[active.index];
    if (!box) return;

    const size = diagramShapeSize(box);
    const { rect } = active;

    if (
      rect.x === box.x &&
      rect.y === box.y &&
      rect.width === size.width &&
      rect.height === size.height
    ) {
      return;
    }

    onResizeBox?.(active.index, rect);
  }

  function handleResizeKeydown(event: KeyboardEvent): void {
    if (!resize || event.key !== "Escape") return;

    event.preventDefault();
    resize = null;
  }

  /** Arrow keys nudge the selection; shift makes the step fine. */
  function nudge(event: KeyboardEvent, index: number): void {
    if (!onMoveBoxes) return;

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

    const seeds = selectedIds.includes(box.id) ? selectedIds : [box.id];
    const movingIds = diagramMoveIds(boxes, seeds);
    const origins = boxes
      .map((candidate, candidateIndex) => ({
        index: candidateIndex,
        x: candidate.x,
        y: candidate.y,
      }))
      .filter((origin) => movingIds.has(boxes[origin.index]?.id ?? ""));
    const clamped = clampedDelta(origins, delta[0], delta[1]);

    event.preventDefault();
    onMoveBoxes(
      origins.map((origin) => ({
        index: origin.index,
        x: Math.round(origin.x + clamped.dx),
        y: Math.round(origin.y + clamped.dy),
      })),
    );
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

    const size = diagramShapeSize(box);
    const schema = schemaNodeLayout(box);
    const localWidth = boxRect.width / zoom;
    const unitScale = localWidth / size.width;
    const headerRatio = schema && size.height > 0 ? schema.headerHeight / size.height : 1;

    labelEditor = {
      index,
      left: (boxRect.left - containerRect.left) / zoom,
      top: (boxRect.top - containerRect.top) / zoom,
      width: localWidth,
      height: (boxRect.height / zoom) * headerRatio,
      fontSize: (schema ? 13 : 16) * unitScale,
      align: schema ? "left" : "center",
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

{#snippet boxShape(box: DiagramBox, lines: string[], firstLineY: number, style: DiagramBoxStyle, isContainer: boolean)}
  <path d={diagramShapePath(box)} fill={style.fill} stroke={style.stroke} stroke-width="2" />
  {#if isContainer}
    {#each lines as line, lineIndex (lineIndex)}
      <text
        x={box.x + 12}
        y={box.y + 20 + lineIndex * 16}
        font-family="Arial, Helvetica, sans-serif"
        font-size="12"
        font-weight="600"
        fill={style.text}
        opacity="0.8">{line}</text>
    {/each}
  {:else}
    {#each lines as line, lineIndex (lineIndex)}
      <text
        x={box.x + diagramShapeSize(box).width / 2}
        y={firstLineY + lineIndex * DIAGRAM_LABEL_LINE_HEIGHT}
        text-anchor="middle"
        font-family="Georgia, serif"
        font-size="16"
        fill={style.text}>{line}</text>
    {/each}
  {/if}
{/snippet}

{#snippet schemaNodeShape(box: DiagramBox, style: DiagramBoxStyle)}
  {@const schema = schemaNodeLayout(box)}
  {#if schema}
    <path d={schema.outlinePath} fill={style.fill} stroke={style.stroke} stroke-width="2" />
    <path d={schema.headerPath} fill={style.stroke} />
    <text
      x={schema.title.x}
      y={schema.title.y}
      font-family="Arial, Helvetica, sans-serif"
      font-size="13"
      font-weight="600"
      fill={colors.paper}>{schema.title.text}</text>
    {#each schema.separators as separator (separator.y)}
      <line
        x1={separator.x1}
        y1={separator.y}
        x2={separator.x2}
        y2={separator.y}
        stroke={style.stroke}
        stroke-opacity="0.18"
        stroke-width="1"
      />
    {/each}
    {#each schema.rows as row (row.y)}
      <text
        x={row.x}
        y={row.y}
        font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
        font-size="11"
        fill={style.text}>{row.text}</text>
    {/each}
  {/if}
{/snippet}

<svelte:window onkeydown={handleResizeKeydown} />

<EditableText as="div" class="eyebrow" path={["eyebrow"]} value={content.eyebrow} />

<div class="body">
  <EditableText as="h2" path={["heading"]} value={content.heading} />

  {#if boxes.length === 0}
    <p class="note">Add a box in the inspector.</p>
  {:else}
    <div class="diagram" class:is-editable={onMoveBoxes !== undefined} bind:this={diagramElement}>
      {#if onMoveBoxes}
        <div class="diagram-zoom" aria-label="Diagram zoom">
          <button
            class="diagram-zoom-button"
            type="button"
            aria-label="Zoom out"
            disabled={zoom <= DIAGRAM_ZOOM_MIN}
            onclick={() => setDiagramZoom(zoom - DIAGRAM_ZOOM_STEP)}>−</button
          >
          <span class="diagram-zoom-value" aria-live="polite">{Math.round(zoom * 100)}%</span>
          <button
            class="diagram-zoom-button"
            type="button"
            aria-label="Zoom in"
            disabled={zoom >= DIAGRAM_ZOOM_MAX}
            onclick={() => setDiagramZoom(zoom + DIAGRAM_ZOOM_STEP)}>+</button
          >
          <button
            class="diagram-zoom-reset"
            type="button"
            aria-label="Reset zoom"
            disabled={zoom <= DIAGRAM_ZOOM_MIN}
            onclick={resetDiagramZoom}>Reset</button
          >
        </div>
      {/if}

      <svg
        bind:this={svgElement}
        viewBox={diagramViewBox}
        role="img"
        aria-label={content.heading}
      >
        {#if onSelectBox}
          <rect
            class="diagram-canvas"
            class:can-pan={zoom > DIAGRAM_ZOOM_MIN}
            class:is-panning={pan !== null}
            x="0"
            y="0"
            width={DIAGRAM_WIDTH}
            height={DIAGRAM_HEIGHT}
            fill="transparent"
            role="button"
            tabindex="-1"
            aria-label="Deselect diagram box"
            onpointerdown={startPan}
            onpointermove={movePan}
            onpointerup={endPan}
            onpointercancel={endPan}
            onclick={handleCanvasClick}
            onkeydown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              onSelectBox(null);
            }}
          />
        {/if}

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

        {#each renderBoxes as { box, index } (box.id)}
          {@const size = diagramShapeSize(box)}
          {@const schema = schemaNodeLayout(box)}
          {@const labelLines = diagramLabelLines(box)}
          {@const boxStyle = diagramBoxStyle(colors, box.tone)}
          {@const firstLineY =
            box.y + size.height / 2 - ((labelLines.length - 1) * DIAGRAM_LABEL_LINE_HEIGHT) / 2 + 5}

          {#if onMoveBoxes}
            <g
              class="diagram-box"
              class:is-dragging={drag?.primaryIndex === index}
              class:is-selected={selectedIds.includes(box.id)}
              class:is-link-target={pendingLinkFrom !== null && pendingLinkFrom !== box.id}
              role="button"
              tabindex="0"
              aria-label={`Move ${box.label || `box ${index + 1}`}`}
              ondblclick={(event) => openLabelEditor(event, index)}
              onclick={(event) => {
                event.stopPropagation();
                if (pendingLinkFrom) linkTo(box.id);
              }}
              onpointerdown={(event) => {
                onSelectBox?.(
                  box.id,
                  event.shiftKey || event.metaKey || event.ctrlKey,
                );
                startDrag(event, index);
              }}
              onpointermove={moveDrag}
              onpointerup={endDrag}
              onpointercancel={endDrag}
              onkeydown={(event) => handleBoxKeydown(event, index, box)}
            >
              <title>Drag to move, double-click to rename</title>
              {#if schema}
                {@render schemaNodeShape(box, boxStyle)}
              {:else}
                {@render boxShape(box, labelLines, firstLineY, boxStyle, containerIds.has(box.id))}
              {/if}
            </g>
          {:else}
            <g class="diagram-box">
              {#if schema}
                {@render schemaNodeShape(box, boxStyle)}
              {:else}
                {@render boxShape(box, labelLines, firstLineY, boxStyle, containerIds.has(box.id))}
              {/if}
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

        {#if onResizeBox && selectedIds.length > 0}
          {#each laidOut as box, index (box.id)}
            {#if selectedIds.includes(box.id)}
              {@const selectedSize = diagramShapeSize(box)}

              <rect
                class="diagram-selection"
                x={box.x}
                y={box.y}
                width={selectedSize.width}
                height={selectedSize.height}
                fill="none"
                stroke={colors.accent}
                stroke-width="1.5"
                stroke-dasharray="5 4"
              />

              {#if selectedIds.length === 1}
                {#each RESIZE_CORNERS as corner (corner.id)}
                  {@const handleX = corner.x === 0 ? box.x : box.x + selectedSize.width}
                  {@const handleY = corner.y === 0 ? box.y : box.y + selectedSize.height}

                  <g
                    class="diagram-resize"
                    style="cursor: {corner.cursor}"
                    role="button"
                    tabindex="-1"
                    aria-label={`Resize ${box.label || `box ${index + 1}`} from the ${corner.id.toUpperCase()} corner`}
                    onpointerdown={(event) => startResize(event, index, corner.id)}
                    onpointermove={moveResize}
                    onpointerup={endResize}
                    onpointercancel={endResize}
                  >
                    <title>Drag to resize</title>
                    <circle cx={handleX} cy={handleY} r="14" fill="transparent" />
                    <rect
                      x={handleX - 5}
                      y={handleY - 5}
                      width="10"
                      height="10"
                      fill={colors.paper}
                      stroke={colors.accent}
                      stroke-width="2"
                    />
                  </g>
                {/each}
              {/if}
            {/if}
          {/each}
        {/if}
      </svg>

      {#if labelEditor}
        {@const renameStyle = diagramBoxStyle(colors, boxes[labelEditor.index]?.tone)}

        <input
          bind:this={labelInput}
          class="diagram-label-input"
          style="left: {labelEditor.left}px; top: {labelEditor.top}px; width: {labelEditor.width}px; height: {labelEditor.height}px; font-size: {labelEditor.fontSize}px; text-align: {labelEditor.align}; color: {renameStyle.text}; border-color: {renameStyle.stroke};"
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
