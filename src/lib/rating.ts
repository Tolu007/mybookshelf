// Book ratings: 0.5 to 5 stars in half-star steps; null means unrated.

export const RATING_MAX = 5;
export const RATING_STEP = 0.5;

// Returns the rating to store (a number, or null to clear it), or
// undefined when the value isn't a valid rating.
export function parseRating(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  if (value < RATING_STEP || value > RATING_MAX) return undefined;
  return Number.isInteger(value * 2) ? value : undefined;
}

export function formatRating(rating: number) {
  return Number.isInteger(rating) ? `${rating}.0` : `${rating}`;
}
