/**
 * The Orders of the Set — the achievement / reward catalog.
 *
 * Pure data + pure evaluation so the SAME definitions run on the server (to
 * compute progress from real stats) and on the client (to render the board).
 * Nothing here touches the database; `glory.stats.server.ts` feeds it numbers.
 *
 * Every order has tiers (levels). A member earns the medal for the highest
 * tier their stat reaches; progress toward the next tier is shown live.
 */

import type { GloryStats } from "./types";

export type AchievementTrack =
  | "global"
  | "bull"
  | "kneeler"
  | "wife"
  | "cuck"
  | "chastity";

export type AchievementIcon =
  | "spade"
  | "crown"
  | "cage"
  | "lips"
  | "lock"
  | "key"
  | "heart"
  | "flame"
  | "medal"
  | "bbc";

export type AchievementDef = {
  id: string;
  track: AchievementTrack;
  icon: AchievementIcon;
  /** The order's name, set in the display serif. */
  name: string;
  /** What you actually did to earn it — in the room's voice. */
  blurb: string;
  /** Stat key this order reads from GloryStats. */
  stat: keyof GloryStats;
  /** Ascending tier thresholds; the label for each tier. */
  tiers: { at: number; label: string }[];
  /** Who can earn it. Everyone unless gated. */
  audience?: "everyone" | "kings" | "kneelers" | "wives" | "cucks" | "chastity";
};

export const ACHIEVEMENTS: AchievementDef[] = [
  // ── Global: every member of the order ──────────────────────────────────
  {
    id: "first-kneel",
    track: "global",
    icon: "spade",
    name: "First Kneel",
    blurb: "Walk through the door and finish your profile.",
    stat: "onboarded",
    tiers: [{ at: 1, label: "Initiated" }],
  },
  {
    id: "claimed",
    track: "global",
    icon: "heart",
    name: "Claimed",
    blurb: "Mutual matches. Two people said yes out loud.",
    stat: "matches",
    tiers: [
      { at: 1, label: "First Match" },
      { at: 5, label: "Sought After" },
      { at: 15, label: "In Demand" },
      { at: 40, label: "Coveted" },
      { at: 100, label: "Legend of the Set" },
    ],
  },
  {
    id: "voice",
    track: "global",
    icon: "flame",
    name: "Voice of the Room",
    blurb: "Post in the Room. Let the order see you.",
    stat: "posts",
    tiers: [
      { at: 1, label: "Spoke Up" },
      { at: 10, label: "Regular" },
      { at: 50, label: "The Room Knows You" },
      { at: 150, label: "Orator" },
    ],
  },
  {
    id: "devout",
    track: "global",
    icon: "spade",
    name: "Devout",
    blurb: "Open conversations. Outreach is worship.",
    stat: "chats",
    tiers: [
      { at: 1, label: "Said Hello" },
      { at: 5, label: "Social" },
      { at: 20, label: "Connector" },
      { at: 50, label: "The Confessor" },
    ],
  },
  {
    id: "kneeler-card",
    track: "global",
    icon: "spade",
    name: "Member of the Set",
    blurb: "Carry the spade in your interests.",
    stat: "wearsSpade",
    tiers: [{ at: 1, label: "Spade Worn" }],
  },

  // ── Bull / king track ──────────────────────────────────────────────────
  {
    id: "bull-stable",
    track: "bull",
    icon: "crown",
    name: "The Stable",
    blurb: "Wives and bottoms who matched with a king. Build the harem.",
    stat: "kingMatches",
    audience: "kings",
    tiers: [
      { at: 1, label: "First Claim" },
      { at: 5, label: "Bull in Demand" },
      { at: 15, label: "The Stable" },
      { at: 40, label: "King of the City" },
    ],
  },
  {
    id: "bull-worshipped",
    track: "bull",
    icon: "bbc",
    name: "Worshipped",
    blurb: "Kneelers who opened your DMs. They found the right king.",
    stat: "kingKneelerChats",
    audience: "kings",
    tiers: [
      { at: 1, label: "First Worshipper" },
      { at: 5, label: "Congregation" },
      { at: 15, label: "House of Worship" },
    ],
  },
  {
    id: "bull-empire",
    track: "bull",
    icon: "flame",
    name: "The Empire",
    blurb: "Every match you make expands the order. Total claims.",
    stat: "matches",
    audience: "kings",
    tiers: [
      { at: 10, label: "Territory" },
      { at: 25, label: "Domain" },
      { at: 75, label: "The Empire" },
    ],
  },

  // ── Kneeler track (sissies / whitebois / CDs / femboys) ─────────────────
  {
    id: "kneeler-serve",
    track: "kneeler",
    icon: "key",
    name: "In Service",
    blurb: "Kings you opened a conversation with. Go serve.",
    stat: "kneelerKingChats",
    audience: "kneelers",
    tiers: [
      { at: 1, label: "On Your Knees" },
      { at: 3, label: "Eager" },
      { at: 10, label: "Devoted Maid" },
      { at: 25, label: "The Good Girl" },
    ],
  },
  {
    id: "kneeler-claimed",
    track: "kneeler",
    icon: "crown",
    name: "Chosen by a King",
    blurb: "Bulls you matched with. A king picked you.",
    stat: "kneelerKingMatches",
    audience: "kneelers",
    tiers: [
      { at: 1, label: "Noticed" },
      { at: 3, label: "Requested" },
      { at: 10, label: "Kept" },
      { at: 25, label: "Favorite Hole" },
    ],
  },
  {
    id: "kneeler-serve-bulls",
    track: "kneeler",
    icon: "bbc",
    name: "Serve Bulls",
    blurb: "Serves a king confirmed. You don't score this one — he does.",
    stat: "servesApproved",
    audience: "kneelers",
    tiers: [
      { at: 1, label: "First Serve" },
      { at: 3, label: "Useful" },
      { at: 10, label: "House Girl" },
      { at: 25, label: "Property of the Set" },
    ],
  },
  {
    id: "kneeler-locks",
    track: "kneeler",
    icon: "cage",
    name: "Lock Count",
    blurb: "Times you took the cage. Obedience is a habit.",
    stat: "locksCompleted",
    audience: "kneelers",
    tiers: [
      { at: 1, label: "Caged Once" },
      { at: 5, label: "Repeat Offender" },
      { at: 15, label: "Permanent Attitude" },
    ],
  },

  // ── Hotwife / QOS track ─────────────────────────────────────────────────
  {
    id: "wife-bred",
    track: "wife",
    icon: "lips",
    name: "Snowbunny",
    blurb: "Kings you matched with. The ring has a spade on it.",
    stat: "wifeKingMatches",
    audience: "wives",
    tiers: [
      { at: 1, label: "Took the First" },
      { at: 5, label: "Snowbunny" },
      { at: 15, label: "QOS Confirmed" },
      { at: 40, label: "Breeding Legend" },
    ],
  },
  {
    id: "wife-night",
    track: "wife",
    icon: "flame",
    name: "Hotwife Nights",
    blurb: "Bulls you opened in the DMs. Schedule the husband.",
    stat: "wifeKingChats",
    audience: "wives",
    tiers: [
      { at: 1, label: "First Night Out" },
      { at: 5, label: "Regular Appointment" },
      { at: 15, label: "Fully Booked" },
    ],
  },

  // ── Cuck track ─────────────────────────────────────────────────────────
  {
    id: "cuck-watch",
    track: "cuck",
    icon: "cage",
    name: "Watch & Hold the Phone",
    blurb: "Kings your wife matched with. You arranged it.",
    stat: "wifeKingMatches",
    audience: "cucks",
    tiers: [
      { at: 1, label: "First Bull" },
      { at: 3, label: "Good Husband" },
      { at: 10, label: "Devoted Cuckold" },
    ],
  },
  {
    id: "cuck-locked",
    track: "cuck",
    icon: "lock",
    name: "Locked Out",
    blurb: "Time spent in the cage while she's out. Serve the lock.",
    stat: "lockedHours",
    audience: "chastity",
    tiers: [
      { at: 24, label: "A Day Locked" },
      { at: 72, label: "Weekend Caged" },
      { at: 168, label: "A Week Locked" },
      { at: 720, label: "A Month Denied" },
    ],
  },

  // ── Chastity track (anyone into the cage) ──────────────────────────────
  {
    id: "chastity-streak",
    track: "chastity",
    icon: "lock",
    name: "The Cage",
    blurb: "Total hours served locked. Denial builds devotion.",
    stat: "lockedHours",
    audience: "chastity",
    tiers: [
      { at: 1, label: "Locked In" },
      { at: 24, label: "Day One" },
      { at: 72, label: "Committed" },
      { at: 168, label: "Chaste" },
      { at: 720, label: "Permanent" },
    ],
  },
  {
    id: "chastity-current",
    track: "chastity",
    icon: "key",
    name: "Currently Caged",
    blurb: "Hours into your present lock. Don't disappoint the holder.",
    stat: "currentLockHours",
    audience: "chastity",
    tiers: [
      { at: 1, label: "Just Locked" },
      { at: 24, label: "One Day Down" },
      { at: 72, label: "Three Days" },
      { at: 168, label: "Deep in It" },
    ],
  },
];

export type TierState = {
  def: AchievementDef;
  value: number;
  /** Highest tier index earned (-1 = none yet). */
  earnedTier: number;
  /** Next tier index (null = maxed). */
  nextTier: number | null;
  /** 0..1 progress toward nextTier. */
  progress: number;
  /** Points earned = (earnedTier + 1) * tier point value. */
  points: number;
};

const TIER_POINTS = 10;

export function evaluateAchievement(def: AchievementDef, stats: GloryStats): TierState {
  const raw = Number(stats[def.stat] ?? 0);
  const value = Number.isFinite(raw) ? raw : 0;
  let earnedTier = -1;
  for (let i = 0; i < def.tiers.length; i += 1) {
    if (value >= def.tiers[i]!.at) earnedTier = i;
  }
  const nextTier = earnedTier + 1 < def.tiers.length ? earnedTier + 1 : null;
  let progress = 1;
  if (nextTier !== null) {
    const prevAt = earnedTier >= 0 ? def.tiers[earnedTier]!.at : 0;
    const targetAt = def.tiers[nextTier]!.at;
    progress = Math.max(0, Math.min(1, (value - prevAt) / Math.max(1, targetAt - prevAt)));
  }
  return {
    def,
    value,
    earnedTier,
    nextTier,
    progress,
    points: (earnedTier + 1) * TIER_POINTS,
  };
}

/** Does this audience apply to the member's identities/interests? */
export function audienceApplies(
  audience: AchievementDef["audience"],
  flags: { isKing: boolean; isKneeler: boolean; isWife: boolean; isCuck: boolean; intoChastity: boolean },
): boolean {
  switch (audience) {
    case "kings":
      return flags.isKing;
    case "kneelers":
      return flags.isKneeler;
    case "wives":
      return flags.isWife;
    case "cucks":
      return flags.isCuck;
    case "chastity":
      return flags.intoChastity;
    default:
      return true;
  }
}

export type Rank = { name: string; min: number; icon: AchievementIcon };

/** Standing in the order, by total order-points. */
export const RANKS: Rank[] = [
  { name: "Uninitiated", min: 0, icon: "spade" },
  { name: "On Your Knees", min: 20, icon: "lock" },
  { name: "Devoted", min: 60, icon: "key" },
  { name: "Knight of the Set", min: 120, icon: "medal" },
  { name: "Crowned", min: 220, icon: "crown" },
];

export function rankFor(points: number): Rank {
  let rank = RANKS[0]!;
  for (const r of RANKS) if (points >= r.min) rank = r;
  return rank;
}

export function nextRank(points: number): Rank | null {
  return RANKS.find((r) => r.min > points) ?? null;
}
