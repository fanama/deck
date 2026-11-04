export interface DownloadTextFileOptions {
  fileName: string;
  text: string;
  mimeType?: string;
}

/**
 * Browser adapter that hands a string to the download flow. It is the only
 * place in the app that touches DOM APIs for exporting.
 */
export function downloadTextFile({ fileName, text, mimeType = "text/plain" }: DownloadTextFileOptions): void {
  const blob = new Blob([text], { type: `${mimeType};charset=utf-8` });
  const objectUrl = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(objectUrl);
}
