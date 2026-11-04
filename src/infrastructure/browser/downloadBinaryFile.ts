/**
 * Browser adapter for downloading bytes. It copies the package into its own
 * ArrayBuffer so the Blob never aliases memory the exporter still owns, then
 * revokes the object URL once the browser has taken the download.
 */
export function downloadBinaryFile({
  fileName,
  bytes,
  mimeType,
}: {
  fileName: string;
  bytes: Uint8Array;
  mimeType: string;
}): void {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);

  const objectUrl = URL.createObjectURL(new Blob([buffer], { type: mimeType }));
  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.rel = "noopener";
  anchor.click();

  URL.revokeObjectURL(objectUrl);
}
