/**
 * Triggers a file download. The object URL is revoked on a delay: revoking
 * synchronously right after click() can cancel the download on iOS Safari.
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Opens the OS share sheet with the file when supported (iPhone/Android:
 * send to Notes, LINE, AirDrop...), otherwise falls back to a download.
 * Must be called synchronously from a tap — share() needs a fresh user
 * gesture, which is lost after any await.
 */
export async function shareOrDownload(blob: Blob, fileName: string, title: string) {
  const file = new File([blob], fileName, { type: blob.type });
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
  };
  const isTouchDevice = navigator.maxTouchPoints > 0;
  if (isTouchDevice && nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title });
      return;
    } catch (e) {
      // User dismissed the sheet — that's a choice, not an error.
      if (e instanceof DOMException && e.name === "AbortError") return;
      // Any other failure (e.g. gesture expired): fall through to download.
    }
  }
  downloadBlob(blob, fileName);
}
