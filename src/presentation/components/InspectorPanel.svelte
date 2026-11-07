<script lang="ts">
  import type { ContentPath } from "../../domain/deck/slideTypes.ts";
  import type { PresentationStudio } from "../state/PresentationStudio.svelte.ts";
  import FieldEditor from "./FieldEditor.svelte";
  import ImageUploadField from "./ImageUploadField.svelte";

  let { studio }: { studio: PresentationStudio } = $props();

  function handleFieldChange(path: ContentPath, value: unknown): void {
    studio.updateSlideField(path, value);
  }

  function handleAppendItem(path: ContentPath): void {
    studio.appendSlideListItem(path);
  }

  function handleRemoveItem(path: ContentPath, index: number): void {
    studio.removeSlideListItem(path, index);
  }

  function handleMoveItem(path: ContentPath, fromIndex: number, toIndex: number): void {
    studio.moveSlideListItem(path, fromIndex, toIndex);
  }
</script>

<div class="inspector">
  <div>
    <h2 class="panel-title">
      Slide {studio.selectedSlideIndex + 1} · {studio.selectedSlideLayout.label}
    </h2>
    <p class="inspector-purpose">{studio.selectedSlideLayout.purpose}</p>
  </div>

  {#if studio.problems.length > 0}
    <ul class="problem-list">
      {#each studio.problems.slice(0, 4) as problem, index (index)}
        <li class="problem {problem.severity}">{problem.message}</li>
      {/each}
    </ul>
  {/if}

  {#if studio.selectedSlide?.layout === "diagram" && studio.selectedDiagramBoxIds.length > 0}
    <div class="diagram-selection-tools">
      <div class="diagram-selection-head">
        <span class="field-label">
          {studio.selectedDiagramBoxIds.length === 1
            ? "1 box selected"
            : `${studio.selectedDiagramBoxIds.length} boxes selected`}
        </span>
        <div class="icon-actions">
          {#if studio.canGroupSelectedDiagramBoxes}
            <button
              class="button small"
              type="button"
              onclick={() => studio.groupSelectedDiagramBoxes()}>Group</button
            >
          {/if}
          {#if studio.selectedDiagramGroupId}
            <button
              class="button small"
              type="button"
              onclick={() => studio.ungroupSelectedDiagramBoxes()}>Ungroup</button
            >
          {/if}
        </div>
      </div>
      <p class="diagram-selection-hint">
        Shift-click to select several boxes, then Group. Drag a box onto another to put it inside;
        drag it out to take it out.
      </p>
    </div>
  {/if}

  {#if studio.selectedSlide}
    {@const selectedSlide = studio.selectedSlide}

    <ImageUploadField
      label="Background image"
      image={selectedSlide.backgroundImage}
      onChange={(image) => studio.changeSlideBackgroundImage(image)}
      onError={(message) => studio.showNotice("error", message)}
    />

    {#if selectedSlide.layout === "image"}
      <ImageUploadField
        label="Slide image"
        image={selectedSlide.content.image}
        onChange={(image) => studio.updateSlideField(["image"], image)}
        onError={(message) => studio.showNotice("error", message)}
      />
    {/if}

    <FieldEditor
      fields={studio.selectedSlideLayout.fields}
      value={selectedSlide.content}
      path={[]}
      onChange={handleFieldChange}
      onAppendItem={handleAppendItem}
      onRemoveItem={handleRemoveItem}
      onMoveItem={handleMoveItem}
    />
  {/if}
</div>
