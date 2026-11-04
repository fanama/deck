/**
 * Full screen is an enhancement, not a requirement: presenting works as an
 * overlay when the API is missing, refused or blocked by a sandbox. Every call
 * here therefore reports nothing and throws nothing — the presenter decides
 * what to draw, not whether the browser granted a display mode.
 */

export function isFullscreenActive(): boolean {
  return document.fullscreenElement !== null;
}

export async function enterFullscreen(): Promise<void> {
  const element = document.documentElement;
  if (!element?.requestFullscreen) return;

  try {
    await element.requestFullscreen({ navigationUI: "hide" });
  } catch {
    // Refused without a gesture, or unsupported in this context.
  }
}

export async function exitFullscreen(): Promise<void> {
  if (!document.fullscreenElement || !document.exitFullscreen) return;

  try {
    await document.exitFullscreen();
  } catch {
    // Already leaving full screen; nothing to undo.
  }
}
