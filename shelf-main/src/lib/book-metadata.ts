type BookMetadata = {
  coverUrl: string | null;
  description: string | null;
  author: string | null;
};

// Best-effort lookup — upload must succeed even if this fails or finds nothing.
export async function fetchBookMetadata(
  title: string,
  author?: string | null
): Promise<BookMetadata | null> {
  try {
    const q = author ? `intitle:${title} inauthor:${author}` : `intitle:${title}`;
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=1`;
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;

    const data = await response.json();
    const item = data.items?.[0]?.volumeInfo;
    if (!item) return null;

    const thumbnail: string | undefined = item.imageLinks?.thumbnail;

    return {
      coverUrl: thumbnail ? thumbnail.replace(/^http:/, "https:") : null,
      description: typeof item.description === "string" ? item.description.slice(0, 2000) : null,
      author: Array.isArray(item.authors) ? item.authors.join(", ") : null,
    };
  } catch {
    return null;
  }
}
