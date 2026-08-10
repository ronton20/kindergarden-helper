// The bridge to the main process, and the one place that knows which build is
// running.
//
// `window.kh` is exposed by preload.js in the installed app and simply does not
// exist when the same page is opened in a browser. So its presence is the test:
// on the desktop a file can be written into Documents and revealed in Explorer;
// in a browser it can only be downloaded, and cards can only go through the
// print dialog.

export interface SavedFile {
  id: string;
  name: string;
}

interface KhBridge {
  desktop: true;
  savePdf(name: string): Promise<{ ok: boolean }>;
  reveal(id: string): Promise<{ ok: boolean }>;
  onSaved(handler: (payload: SavedFile) => void): void;
}

declare global {
  interface Window {
    kh?: KhBridge;
  }
}

export const bridge = (): KhBridge | undefined =>
  typeof window !== 'undefined' && window.kh?.desktop ? window.kh : undefined;

export const isDesktop = (): boolean => !!bridge();

/**
 * Hand a blob to the browser as a download. On the desktop a `will-download`
 * handler redirects it into Documents; in a browser it lands wherever that
 * browser downloads to. Either way the *name* is ours.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
