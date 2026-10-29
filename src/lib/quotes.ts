export type Quote = { text: string; author?: string };

export const QUOTES: Quote[] = [
  { text: "Ask and you shall receive, seek and you shall find." },
  { text: "Formal education will make you a living; self-education will make you a fortune." },
];

// Same quote all day, rotating at midnight, so it feels intentional rather
// than flickering on every refresh.
export function quoteIndexForDay(date = new Date()) {
  const dayNumber = Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000
  );
  return dayNumber % QUOTES.length;
}
