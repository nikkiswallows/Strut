/**
 * ──────────────────────────────────────────────────────────────────────────
 * SEO central — one place for the canonical origin, the keyword universe,
 * and the structured data the crawlers read.
 *
 * The public, indexable surface of Strut is small by design (the club is
 * behind the door): the landing page and the login page. Everything else is
 * noindex. That means the landing page has to carry ALL of the ranking
 * weight for BNWO / QOS / bull / hotwife / sissy / cuck queries — so it gets
 * the FAQ copy, the FAQPage JSON-LD, and the exact-phrase title.
 * ──────────────────────────────────────────────────────────────────────────
 */

import { NAME, DESCRIPTION, TAGLINE } from "@/lib/brand";

/** Canonical production origin. Keep in sync with public-origin.server.ts. */
export const SITE_URL = "https://strut-zeta.vercel.app";

/** Absolute URL for a path on the canonical origin. */
export function abs(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** The query universe we want to own. Used in meta keywords + copy. */
export const KEYWORDS = [
  "BNWO",
  "BNWO dating",
  "BNWO dating app",
  "Black New World Order",
  "Queen of Spades dating",
  "QOS dating",
  "queen of spades app",
  "BBC dating",
  "bull dating app",
  "hotwife dating",
  "cuckold dating",
  "interracial cuckold",
  "sissy dating",
  "whiteboi",
  "chastity dating",
  "snowbunny dating",
  "black owned dating app",
].join(", ");

/** Default share image (1200×630, already in /public). */
export const OG_IMAGE = abs("/og.jpg");

/** Organization JSON-LD — who runs the room. */
export const ORG_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: NAME,
  url: SITE_URL,
  logo: abs("/icon-512.png"),
  slogan: TAGLINE,
  description: DESCRIPTION,
} as const;

/** WebSite JSON-LD — names the site for the "Strut" brand query. */
export const WEBSITE_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: `${NAME} — BNWO dating`,
  alternateName: ["Strut BNWO", "Strut dating", "BNWO dating app"],
  url: SITE_URL,
  description: DESCRIPTION,
} as const;

/** WebApplication JSON-LD — free dating app, adult audience. */
export const APP_LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: NAME,
  url: SITE_URL,
  applicationCategory: "SocialNetworkingApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  audience: { "@type": "PeopleAudience", requiredMinAge: 18 },
  description: DESCRIPTION,
} as const;

/**
 * The landing-page FAQ. Rendered VISIBLY on the page (Google requires the
 * JSON-LD to mirror on-page content) and emitted as FAQPage structured data.
 * Every question is a real query people type; every answer carries the
 * phrase naturally and sells the door.
 */
export const FAQ: { q: string; a: string }[] = [
  {
    q: "What is BNWO?",
    a: "BNWO stands for Black New World Order — a kink and lifestyle community built around Black male supremacy as a consensual power dynamic: Black bulls and kings first, worshippers, sissies, whitebois, hotwives and cuckolds in service. Strut is the dating app built for exactly that order — every profile picks its place before it walks in.",
  },
  {
    q: "What does Queen of Spades (QOS) mean?",
    a: "The Queen of Spades — the spade with a Q — is the symbol worn by women who date Black men first and only. On Strut, QOS wives and snowbunnies carry the spade on their profile so bulls see it from the deck. If the ring has a spade on it, this is her app.",
  },
  {
    q: "What is a bull in BNWO dating?",
    a: "A bull is a dominant Black top — the king of the room. On Strut, bulls walk in first: the deck ranks kings first, kneelers open conversations with them, wives book their nights, and a bull's word is what approves a kneeler's service. It is the only dating app where the hierarchy is the feature.",
  },
  {
    q: "Is Strut for sissies, whitebois and cucks?",
    a: "Yes — that's the point of the room. Sissies, faggots, whitebois, femboys, crossdressers and cuckolds join as kneelers: locked bottoms in service of Black kings. The app enforces the role — kneelers can't list themselves as tops, and the Glory page tracks serves, lock time in chastity, and being chosen by a king.",
  },
  {
    q: "Do hotwives and couples use Strut?",
    a: "Hotwife and cuckold couples are one of the core tracks. She matches with bulls, he watches and holds the phone — the app has a dedicated hotwife track, cuckold orders, and a chastity cage timer for locked husbands. Breeding, QOS and locked-out-husband dynamics are said out loud here, not hidden in a bio.",
  },
  {
    q: "What is the cage on Strut?",
    a: "The cage is Strut's built-in chastity timer. Kneelers and cucks pledge a lock — a day, a week, a month, or indefinite — and the app tracks hours served locked toward chastity orders and rank. Denial builds devotion, and the leaderboard remembers.",
  },
  {
    q: "Is Strut free? Who can join?",
    a: "Strut is free to join and strictly 18+. Black kings, Queen of Spades wives, sissies, whitebois, T-girls, trans women, femboys, crossdressers, hotwives, cucks and couples — everyone enters through the same door, states their place, and consents to the order. Everything on Strut is consensual adult roleplay between verified-adult members.",
  },
];

export const FAQ_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map(({ q, a }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a },
  })),
} as const;

/** Serialize JSON-LD for a <script type="application/ld+json"> tag. */
export function ld(json: object): string {
  // "<" escaped so user-ish strings can never close the script tag early.
  return JSON.stringify(json).replace(/</g, "\\u003c");
}
