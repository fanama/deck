<script lang="ts">
  import type { StudioNotice } from "../state/PresentationStudio.svelte.ts";

  let { notice, onDismiss }: { notice: StudioNotice; onDismiss: () => void } = $props();
</script>

<div class="notice {notice.kind}" role="status">
  <span>{notice.message}</span>
  <button class="icon-button" type="button" aria-label="Dismiss message" onclick={onDismiss}>×</button>
</div>
