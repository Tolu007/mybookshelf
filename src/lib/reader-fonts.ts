import { EB_Garamond, Literata } from "next/font/google";

// Extra reading typefaces, loaded only where they're previewed (Settings).
// Newsreader and Jakarta Sans are already loaded app-wide.
export const garamond = EB_Garamond({ variable: "--font-garamond", subsets: ["latin"], style: ["normal", "italic"] });
export const literata = Literata({ variable: "--font-literata", subsets: ["latin"], style: ["normal", "italic"] });
