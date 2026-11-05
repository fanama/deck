<script lang="ts">
  import type { FieldDefinition } from "../../domain/deck/slideLayoutCatalog.ts";
  import type { ContentPath } from "../../domain/deck/slideTypes.ts";
  import FieldEditor from "./FieldEditor.svelte";

  let {
    fields,
    value,
    path = [],
    onChange,
    onAppendItem,
    onRemoveItem,
    onMoveItem,
  }: {
    fields: FieldDefinition[];
    /** The edited content object; cast here so callers can pass typed slide content. */
    value: unknown;
    path?: ContentPath;
    onChange: (path: ContentPath, value: string) => void;
    onAppendItem: (path: ContentPath) => void;
    onRemoveItem: (path: ContentPath, index: number) => void;
    onMoveItem: (path: ContentPath, fromIndex: number, toIndex: number) => void;
  } = $props();

  const content = $derived(value as Record<string, unknown>);

  function textValue(key: string): string {
    const rawValue = content[key];
    return typeof rawValue === "string" ? rawValue : "";
  }

  function itemText(item: unknown): string {
    return typeof item === "string" ? item : "";
  }

  function listItems(fieldKey: string): unknown[] {
    const items = content[fieldKey];
    return Array.isArray(items) ? items : [];
  }
</script>

{#each fields as field (field.key)}
  {@const fieldPath = [...path, field.key]}

  {#if field.type === "text"}
    <label class="field">
      <span class="field-label">{field.label}</span>
      <input
        class="field-input"
        type="text"
        value={textValue(field.key)}
        maxlength={field.maxLength}
        oninput={(event) => onChange(fieldPath, event.currentTarget.value)}
      />
    </label>
  {:else if field.type === "textarea"}
    <label class="field">
      <span class="field-label">{field.label}</span>
      <textarea
        class="field-input"
        rows="2"
        value={textValue(field.key)}
        maxlength={field.maxLength}
        oninput={(event) => onChange(fieldPath, event.currentTarget.value)}
      ></textarea>
      <span class="field-hint">{textValue(field.key).length} / {field.maxLength}</span>
    </label>
  {:else if field.type === "select"}
    <label class="field">
      <span class="field-label">{field.label}</span>
      <select
        class="field-input"
        value={textValue(field.key)}
        onchange={(event) => onChange(fieldPath, event.currentTarget.value)}
      >
        {#each field.options as option (option.value)}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
    </label>
  {:else if field.type === "list"}
    <div class="field-group">
      <div class="field-group-head">
        <span class="field-label">{field.label}</span>
        <span class="field-hint">{listItems(field.key).length} / {field.maxItems}</span>
      </div>

      {#each listItems(field.key) as item, index (index)}
        <div class="field-item">
          <div class="field-item-head">
            <span class="field-item-title">{field.itemLabel} {index + 1}</span>
            <div class="icon-actions">
              <button
                type="button"
                class="icon-button"
                aria-label="Move {field.itemLabel.toLowerCase()} up"
                disabled={index === 0}
                onclick={() => onMoveItem(fieldPath, index, index - 1)}
              >↑</button>
              <button
                type="button"
                class="icon-button"
                aria-label="Move {field.itemLabel.toLowerCase()} down"
                disabled={index === listItems(field.key).length - 1}
                onclick={() => onMoveItem(fieldPath, index, index + 1)}
              >↓</button>
              <button
                type="button"
                class="icon-button"
                aria-label="Remove {field.itemLabel.toLowerCase()}"
                onclick={() => onRemoveItem(fieldPath, index)}
              >×</button>
            </div>
          </div>

          {#if field.itemFields}
            <FieldEditor
              fields={field.itemFields}
              value={item}
              path={[...fieldPath, index]}
              {onChange}
              {onAppendItem}
              {onRemoveItem}
              {onMoveItem}
            />
          {:else}
            <input
              class="field-input"
              type="text"
              value={itemText(item)}
              maxlength={field.maxLength}
              oninput={(event) => onChange([...fieldPath, index], event.currentTarget.value)}
            />
          {/if}
        </div>
      {/each}

      <button
        type="button"
        class="button small"
        disabled={listItems(field.key).length >= field.maxItems}
        onclick={() => onAppendItem(fieldPath)}
      >
        Add {field.itemLabel.toLowerCase()}
      </button>
    </div>
  {/if}
{/each}
