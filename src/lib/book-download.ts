import { BOOK_FILE_ERRORS, isBookFileErrorCode } from "@/lib/book-file-errors";

export type ReaderLoadState =
  | { phase: "downloading"; loaded: number; total: number | null }
  | { phase: "opening" }
  | { phase: "ready" }
  | { phase: "error"; message: string; reconnect?: boolean };

export const INITIAL_READER_LOAD: ReaderLoadState = { phase: "downloading", loaded: 0, total: null };

export class BookDownloadError extends Error {
  constructor(message: string, public readonly reconnect = false) {
    super(message);
  }
}

export function readerErrorState(error: unknown): ReaderLoadState {
  return { phase: "error", message: readerErrorMessage(error), reconnect: error instanceof BookDownloadError && error.reconnect };
}

export function readerErrorMessage(error: unknown): string {
  if (error instanceof BookDownloadError) return error.message;
  return "We couldn't open this book. The file may be damaged or unsupported. Try again, or upload a fresh copy from your library.";
}

// Read the same file URL used by the offline cache, reporting actual bytes rather
// than simulated progress. Abort stalled transfers as well as abandoned readers.
export async function downloadBook(
  bookId: string,
  signal: AbortSignal,
  onProgress: (state: ReaderLoadState) => void,
  stallTimeoutMs = 45_000,
): Promise<ArrayBuffer> {
  const stalled = new AbortController();
  const combinedSignal = AbortSignal.any([signal, stalled.signal]);
  let timeout: ReturnType<typeof setTimeout>;
  const resetTimeout = () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => stalled.abort(), stallTimeoutMs);
  };
  resetTimeout();
  try {
    onProgress(INITIAL_READER_LOAD);
    const response = await fetch(`/api/books/${bookId}/file`, { signal: combinedSignal });
    if (response.redirected && new URL(response.url).pathname === "/login") {
      throw new BookDownloadError("Your sign-in has expired. Sign in again to download this book.");
    }
    if (!response.ok) {
      const code = response.headers.get("X-Book-Error");
      if (isBookFileErrorCode(code)) {
        const failure = BOOK_FILE_ERRORS[code];
        throw new BookDownloadError(failure.message, failure.reconnect);
      }
      const messages: Record<number, string> = {
        401: "Your sign-in has expired. Sign in again to download this book.",
        403: "We couldn't access this book in Google Drive. Sign out and sign in again to reconnect Drive.",
        404: "This book's file is no longer available. Check Google Drive, or upload a fresh copy from your library.",
        429: "Too many download requests. Please wait a moment and try again.",
      };
      throw new BookDownloadError(messages[response.status] ?? "The book service is temporarily unavailable. Please try again in a moment.", response.status === 403);
    }
    const size = Number(response.headers.get("X-Book-Size") ?? (
      response.headers.has("Content-Encoding") ? null : response.headers.get("Content-Length")
    ));
    const total = Number.isFinite(size) && size > 0 ? size : null;
    if (!response.body) throw new BookDownloadError("The download was empty. Please try again.");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.byteLength;
        resetTimeout();
        onProgress({ phase: "downloading", loaded, total });
      }
    } finally {
      reader.releaseLock();
    }
    if (loaded === 0) throw new BookDownloadError("The download was empty. Please try again.");
    if (total !== null && loaded !== total) {
      throw new BookDownloadError("The download was interrupted before it finished. Check your connection and try again.");
    }
    const bytes = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    onProgress({ phase: "opening" });
    return bytes.buffer;
  } catch (error) {
    if (signal.aborted) throw error;
    if (error instanceof BookDownloadError) throw error;
    if (stalled.signal.aborted) {
      throw new BookDownloadError("The download stopped responding. Check your connection and try again.");
    }
    throw new BookDownloadError("We couldn't finish downloading this book. Check your internet connection and try again. Books you've already downloaded may still be available offline.");
  } finally {
    clearTimeout(timeout!);
  }
}
