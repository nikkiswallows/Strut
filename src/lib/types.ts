export const IDENTITIES = [
  "Trans woman",
  "T-Girl",
  "Sissy",
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

export const DISCOVER_TABS = [
  { id: "nearby", label: "Nearby", match: [] as string[] },
  { id: "kings", label: "Kings", match: ["Man", "Admirer", "Bull"] },
  { id: "sissies", label: "Sissies", match: ["Sissy"] },
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
