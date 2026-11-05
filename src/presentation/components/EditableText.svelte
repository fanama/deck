<script lang="ts">
  import { getContext } from "svelte";
  import type { ContentPath } from "../../domain/deck/slideTypes.ts";
  import { SLIDE_TEXT_EDITING } from "./slideTextEditing.ts";
  import type { SlideTextEditing } from "./slideTextEditing.ts";

  type EditableTag =
    | "span"
    | "div"
    | "h1"
    | "h2"
    | "h3"
    | "p"
    | "strong"
    | "li"
    | "th"
    | "td"
    | "dt"
    | "dd"
    | "small";

  let {
    as = "span",
    path,
    value,
    class: className,
  }: {
    /** Same tag the layout used before, so `deck.css` keeps matching. */
    as?: EditableTag;
    path: ContentPath;
    value: string;
    class?: string;
  } = $props();

  const editing = getContext<SlideTextEditing | undefined>(SLIDE_TEXT_EDITING);
  const canEdit = $derived(editing?.canEdit() === true);

  const editLabel = $derived(`Edit ${path.filter((segment) => typeof segment === "string").join(" ")}`);

  let element = $state<HTMLElement | undefined>(undefined);
  let isReverting = $state(false);

  /**
   * The deck owns the text. The DOM is only rewritten when the caret is
   * elsewhere, so typing never loses its place.
   */
  $effect(() => {
    const node = element;
    const text = value;

    if (!node || document.activeElement === node) return;
    if (node.textContent !== text) node.textContent = text;
  });

  function normalise(text: string): string {
    return text.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  }

  function commit(): void {
    if (isReverting) {
      isReverting = false;
      return;
    }

    const next = normalise(element?.textContent ?? "");
    if (next !== value) editing?.commit(path, next);
  }

  function revert(): void {
    isReverting = true;
    if (element) element.textContent = value;
    element?.blur();
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (!canEdit) return;

    if (event.key === "Escape") {
      event.preventDefault();
      revert();
      return;
    }

    // One line per field: the layouts wrap text themselves, and a stray
    // newline in the data would collapse in HTML anyway.
    if (event.key === "Enter") {
      event.preventDefault();
      element?.blur();
    }
  }

  /** Pasted markup would fight the layout, so only the plain text is kept. */
  function handlePaste(event: ClipboardEvent): void {
    if (!canEdit) return;

    const text = event.clipboardData?.getData("text/plain");
    if (text === undefined) return;

    event.preventDefault();

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    range.deleteContents();

    const inserted = document.createTextNode(normalise(text));
    range.insertNode(inserted);
    range.setStartAfter(inserted);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }
</script>

<svelte:element
  this={as}
  bind:this={element}
  class="slide-text {className ?? ''}"
  contenteditable={canEdit ? "true" : undefined}
  spellcheck={canEdit ? "false" : undefined}
  role={canEdit ? "textbox" : undefined}
  aria-label={canEdit ? editLabel : undefined}
  onkeydown={handleKeydown}
  onpaste={handlePaste}
  onblur={commit}
></svelte:element>
