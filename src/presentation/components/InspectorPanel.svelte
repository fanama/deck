<script lang="ts">
  import type { ContentPath } from "../../domain/deck/slideTypes.ts";
  import type { PresentationStudio } from "../state/PresentationStudio.svelte.ts";
  import FieldEditor from "./FieldEditor.svelte";

  let { studio }: { studio: PresentationStudio } = $props();

  function handleFieldChange(path: ContentPath, value: string): void {
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

  {#if studio.selectedSlide}
    <FieldEditor
      fields={studio.selectedSlideLayout.fields}
      value={studio.selectedSlide.content}
      path={[]}
      onChange={handleFieldChange}
      onAppendItem={handleAppendItem}
      onRemoveItem={handleRemoveItem}
      onMoveItem={handleMoveItem}
    />
  {/if}
</div>
