/**
 * ──────────────────────────────────────────────────────────────────────────
 * Strut — brand central.
 *
 * Every screen reads the name, tagline and manifesto from here so the brand
 * lives in ONE place. Want to rename the club? Change `NAME` and reload.
 *
 * Brand: black / ivory / gold. The spade. The crown. "Black first. Kneel
 * second." Loud, deliberate, 18+ BNWO.
 * ──────────────────────────────────────────────────────────────────────────
 */

/** The wordmark. */
export const NAME = "Strut";

/** The order of the room, said out loud. */
export const TAGLINE = "Black first. Kneel second.";

/** Long tagline used on the landing hero. */
export const MANIFESTO_LINE = "BBC first. Kneel. Stay.";

/** Marketing blurb (meta description / manifest). */
export const DESCRIPTION =
  "Strut — the BNWO dating club. Black kings, Queen of Spades, sissies, whitebois, hotwives, cucks and T-girls. Say it out loud. 18+.";

/** The ticker that runs under the hero. Loud, repeated, unmissable. */
export const TICKER_WORDS = [
  "BBC FIRST",
  "WHITEBOI KNEEL",
  "SISSIES SERVE",
  "QOS",
  "BREED THE WIFE",
  "CUCK WATCHES",
  "BNWO IS REAL",
  "ON YOUR KNEES",
  "LOCKED & LOYAL",
  "KINGS WALK IN FIRST",
];

export function tickerText(): string {
  return TICKER_WORDS.join("  ·  ") + "  ·  ";
}

/** Age gate line repeated on public surfaces. */
export const AGE_LINE = "18+ only";
