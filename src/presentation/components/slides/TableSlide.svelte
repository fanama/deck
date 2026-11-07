<script lang="ts">
  import type { TableRow, TableSlideContent } from "../../../domain/deck/slideTypes.ts";
  import { computeTableLayout, isNumericCell } from "../../../shared/tableLayout.ts";
  import EditableText from "../EditableText.svelte";

  let { content }: { content: TableSlideContent } = $props();

  const layout = $derived(computeTableLayout(content));

  /** A row can sit under fewer headers than the table declares; pad the gap. */
  function paddedCells(row: TableRow): string[] {
    return content.columns.map((_column, index) => row.cells[index] ?? "");
  }

  function columnWidth(share: number): string {
    return `${(share * 100).toFixed(2)}%`;
  }
</script>

<EditableText as="div" class="eyebrow" path={["eyebrow"]} value={content.eyebrow} />

<div class="body">
  <EditableText as="h2" path={["heading"]} value={content.heading} />

  <table class="table" style="--table-row-height: {Math.round(layout.rowHeight)}px">
    <colgroup>
      {#each layout.columnShares as share, index (index)}
        <col style="width: {columnWidth(share)}" />
      {/each}
    </colgroup>
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
              class={isNumericCell(cell) ? "is-number" : undefined}
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
