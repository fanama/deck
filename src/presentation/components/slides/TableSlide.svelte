<script lang="ts">
  import type { TableRow, TableSlideContent } from "../../../domain/deck/slideTypes.ts";
  import EditableText from "../EditableText.svelte";

  let { content }: { content: TableSlideContent } = $props();

  /** A row can sit under fewer headers than the table declares; pad the gap. */
  function paddedCells(row: TableRow): string[] {
    return content.columns.map((_column, index) => row.cells[index] ?? "");
  }
</script>

<EditableText as="div" class="eyebrow" path={["eyebrow"]} value={content.eyebrow} />

<div class="body">
  <EditableText as="h2" path={["heading"]} value={content.heading} />

  <table class="table">
    <thead>
      <tr>
        <EditableText as="th" path={["rowHeader"]} value={content.rowHeader} />
        {#each content.columns as column, index (index)}
          <EditableText as="th" path={["columns", index]} value={column} />
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each content.rows as row, rowIndex (rowIndex)}
        <tr>
          <td>
            <EditableText
              as="span"
              class="row-label"
              path={["rows", rowIndex, "label"]}
              value={row.label}
            />
            {#if row.detail}
              <EditableText
                as="span"
                class="row-detail"
                path={["rows", rowIndex, "detail"]}
                value={row.detail}
              />
            {/if}
          </td>
          {#each paddedCells(row) as cell, cellIndex (cellIndex)}
            <EditableText
              as="td"
              path={["rows", rowIndex, "cells", cellIndex]}
              value={cell}
            />
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>

  {#if content.note}
    <EditableText as="p" class="note" path={["note"]} value={content.note} />
  {/if}
</div>
