export const IDENTITIES = [
  "Trans woman",
  "T-Girl",
  "Sissy",
  "Faggot",
  "Whiteboi",
  "Crossdresser",
  "Femboy",
  "Hotwife",
  "Cuck",
  "Bull",
  "Non-binary femme",
  "Genderfluid",
  "Questioning",
  "Woman",
  "Man",
  "Admirer",
  "Couple",
  "Group",
] as const;

export const LOOKING_FOR = [
  "Friends",
  "Dates",
  "Relationship",
  "Now",
  "Chat",
  "BBC",
  "Bulls",
  "To serve",
  "To be bred",
  "Cuckold",
  "Cleanup",
  "Chastity",
  "Hotwife nights",
] as const;

export const PRONOUNS = ["she/her", "they/them", "she/they", "he/him", "he/they", "any"] as const;

export const ROLES = ["Top", "Bottom", "Switch", "Side"] as const;

// Ethnicity / origin categories surfaced on the profile and used as a discover
// filter. This is the identity dimension the demographic reads first, so it
// lives as a first-class field (not buried in interests tag soup). It is
// normalized to the canonical casing on save; matching is case-insensitive.
export const ETHNICITIES = [
  "Black",
  "White",
  "Latina",
  "Asian",
  "Middle Eastern",
  "Indigenous",
  "Mixed",
  "Other",
] as const;

export type Ethnicity = (typeof ETHNICITIES)[number];

export const INTERESTS = [
  "Fashion",
  "Heels",
  "Makeup",
  "Nights out",
  "House music",
  "Pop",
  "Fitness",
  "Coffee",
  "Film",
  "Travel",
  "Photography",
  "Cooking",
  "Beach",
  "Art",
  "Karaoke",
  "Vintage",
  "Lingerie",
  "BNWO",
  "QOS",
  "Cuckold",
  "BBC",
  "Daddies",
  "Hotwife",
  "Breeding",
  "Feminization",
  "Interracial",
  "Cleanup",
  "Chastity",
  "SPH",
  "Hypno",
  "BBC Hypno",
  "Locked",
  "Sissy training",
  "Cuckoldress",
  "Interracial breeding",
  "Kneeling",
] as const;

/**
 * Deck tabs.
 *
 * `kings` used to match ["Man", "Admirer", "Bull"], but the app's own role rules
 * (`bnwo.ts`) only treat "Bull" as a king. That meant the Kings tab — the
 * scarcest, highest-value cohort, and the reason everyone else joins — was
 * populated with anyone who ticked "Man", including submissive men looking for
 * a Top. Precision beats recall on the tab that defines the product, so kings
 * now matches Bull alone and everyone else gets their own tab.
 */
export const DISCOVER_TABS = [
  { id: "nearby", label: "Nearby", match: [] as string[] },
  { id: "kings", label: "Kings", match: ["Bull"] },
  { id: "men", label: "Men", match: ["Man", "Admirer"] },
  { id: "sissies", label: "Sissies", match: ["Sissy"] },
  { id: "faggots", label: "Faggots", match: ["Faggot"] },
  { id: "whitebois", label: "Whitebois", match: ["Whiteboi"] },
  { id: "trans", label: "Trans", match: ["T-Girl", "Trans woman"] },
  { id: "crossdressers", label: "CDs", match: ["Crossdresser"] },
  { id: "femboys", label: "Femboys", match: ["Femboy"] },
  { id: "women", label: "Wives", match: ["Woman", "Hotwife"] },
  { id: "couples", label: "Cucks", match: ["Couple", "Cuck"] },
  { id: "groups", label: "Groups", match: ["Group"] },
] as const;

export const MILE_STOPS = [5, 10, 25, 50, 100, 250, 500] as const;

export type DiscoverTab = (typeof DISCOVER_TABS)[number]["id"];
export type Identity = (typeof IDENTITIES)[number];
export type LookingFor = (typeof LOOKING_FOR)[number];
export type Role = (typeof ROLES)[number];

export type Profile = {
  id: number;
  userId: string;
  handle: string;
  displayName: string;
  age: number | null;
  hideAge: boolean;
  /** Blurred photos in deck/grids until tapped (closeted-user safety). */
  discreet: boolean;
  identities: string[];
  pronouns: string[];
  role: string | null;
  bio: string;
  location: string | null;
  ethnicity: string | null;
  lookingFor: string[];
  photos: string[];
  interests: string[];
  heightCm: number | null;
  lat: number | null;
  lng: number | null;
  isSeed: boolean;
  lastActive: string;
  onboarded: boolean;
  createdAt: string;
  /** ISO `YYYY-MM-DD`. Required to create a profile; immutable afterward. */
  birthDate: string | null;
  /** Tiny data-URI blur placeholders, aligned index-wise with `photos`. */
  photoBlurs: string[];
  likedByMe?: boolean;
  likesMe?: boolean;
  matched?: boolean;
  following?: boolean;
  likeCount?: number;
  distanceMiles?: number | null;
};

export function shownAge(profile: Pick<Profile, "age" | "hideAge">): number | null {
  return profile.hideAge ? null : profile.age;
}

export function identityLine(profile: Pick<Profile, "identities">): string {
  return (profile.identities ?? []).filter(Boolean).join(" · ");
}

export function pronounLine(profile: Pick<Profile, "pronouns">): string {
  return (profile.pronouns ?? []).filter(Boolean).join(" · ");
}

export function roleLine(profile: Pick<Profile, "role">): string | null {
  return profile.role?.trim() || null;
}

export function lookingLine(profile: Pick<Profile, "lookingFor">): string | null {
  const items = (profile.lookingFor ?? []).map((s) => s.trim()).filter(Boolean);
  if (!items.length) return null;
  return `Looking for ${items.join(" · ").toLowerCase()}`;
}

export function asPhotoList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

export type FeedPost = {
  id: number;
  userId: string;
  body: string;
  photoUrl: string | null;
  createdAt: string;
  likedByMe: boolean;
  likeCount: number;
  author: {
    handle: string;
    displayName: string;
    photo: string | null;
  };
};

export type ConversationPreview = {
  id: number;
  other: {
    userId: string;
    handle: string;
    displayName: string;
    photo: string | null;
  };
  lastBody: string | null;
  lastAt: string;
  unread: number;
};

export type ChatMessage = {
  id: number;
  conversationId: number;
  senderId: string;
  body: string;
  createdAt: string;
  mine: boolean;
};

export type LikeBundle = {
  incoming: Profile[];
  outgoing: Profile[];
  matches: Profile[];
};

/**
 * Raw counts that drive the Orders of the Set (achievement board). Every
 * number is computed live from existing tables; the only new state is the
 * chastity lock session log. See `src/lib/achievements.ts`.
 */
export type GloryStats = {
  onboarded: number;
  matches: number;
  posts: number;
  chats: number;
  likesSent: number;
  likesReceived: number;
  wearsSpade: number;
  /** matches where the OTHER person is a bull (king) and viewer is not. */
  kingMatches: number;
  /** matches with a bull, counted for a kneeler viewer. */
  kneelerKingMatches: number;
  /** matches with a bull, counted for a hotwife viewer. */
  wifeKingMatches: number;
  /** conversations a king has with kneelers. */
  kingKneelerChats: number;
  /** conversations a kneeler opened/has with kings. */
  kneelerKingChats: number;
  /** conversations a wife has with kings. */
  wifeKingChats: number;
  /** serves a bull APPROVED — the only way "Serve Bulls" moves. */
  servesApproved: number;
  /** serve claims still waiting on a bull's word. */
  servesPending: number;
  /** completed lock sessions. */
  locksCompleted: number;
  /** total hours served across all (completed + elapsed) locks. */
  lockedHours: number;
  /** hours into the currently-open lock, 0 if not caged now. */
  currentLockHours: number;
};

export type LockSession = {
  id: number;
  startedAt: string;
  releasedAt: string | null;
  pledgeHours: number | null;
  completed: boolean;
  note: string | null;
  /** elapsed hours, rounded to 1 decimal (0 if open & just started). */
  elapsedHours: number;
  /** for an open lock: 0..1 progress toward the pledge (1 if no pledge). */
  pledgeProgress: number;
  open: boolean;
};

export type GloryBoard = {
  stats: GloryStats;
  flags: {
    isKing: boolean;
    isKneeler: boolean;
    isWife: boolean;
    isCuck: boolean;
    intoChastity: boolean;
  };
  points: number;
  rankName: string;
  rankIcon: string;
  nextRankName: string | null;
  nextRankAt: number | null;
  /** ids of achievements with at least one tier earned. */
  earnedIds: string[];
  currentLock: LockSession | null;
  locks: LockSession[];
  /** pending serve claims addressed to the viewer (bulls only). */
  serveApprovals: ServeClaim[];
};

export type ServeClaim = {
  id: number;
  kneeler: {
    userId: string;
    handle: string;
    displayName: string;
    photo: string | null;
  };
  createdAt: string;
};
