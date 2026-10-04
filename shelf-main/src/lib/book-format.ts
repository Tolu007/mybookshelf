export type BookFormat = "pdf" | "epub";

const MIME_TO_FORMAT: Record<string, BookFormat> = {
  "application/pdf": "pdf",
  "application/epub+zip": "epub",
};

export function detectBookFormat(name: string, mimeType?: string | null): BookFormat | null {
  if (mimeType && MIME_TO_FORMAT[mimeType]) return MIME_TO_FORMAT[mimeType];
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".epub")) return "epub";
  return null;
}
