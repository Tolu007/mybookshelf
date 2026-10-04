function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function extractEpubCover(file: File): Promise<string | null> {
  const Epub = (await import("epubjs")).default;
  const book = Epub(await file.arrayBuffer());
  try {
    const url = await book.coverUrl();
    if (!url) return null;
    const blob = await (await fetch(url)).blob();
    return await blobToDataUrl(blob);
  } finally {
    book.destroy();
  }
}

async function extractPdfCover(file: File): Promise<string | null> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  try {
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 0.6 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvas, viewport }).promise;
    return canvas.toDataURL("image/jpeg", 0.75);
  } finally {
    pdf.loadingTask.destroy();
  }
}

// Best-effort: a failed extraction just means the upload falls back to a
// metadata-sourced cover, or the plain letter placeholder. Never block upload.
export async function extractClientCover(
  file: File,
  format: "pdf" | "epub"
): Promise<string | null> {
  try {
    return format === "epub" ? await extractEpubCover(file) : await extractPdfCover(file);
  } catch {
    return null;
  }
}
