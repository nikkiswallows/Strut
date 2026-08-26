export const IDENTITIES = [
  "Trans woman",
  "T-Girl",
  "Sissy",
  "Crossdresser",
  "Femboy",
  "Non-binary femme",
  "Genderfluid",
  "Questioning",
  "Woman",
  "Man",
  "Admirer",
  "Couple",
  "Group",
] as const;

export const LOOKING_FOR = ["Friends", "Dates", "Relationship", "Now", "Chat"] as const;

export const PRONOUNS = ["she/her", "they/them", "she/they", "he/him", "he/they", "any"] as const;

export const ROLES = ["Top", "Bottom", "Switch", "Side"] as const;

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
  "Cuckold",
  "BBC",
  "Daddies",
  "Hotwife",
] as const;

export const DISCOVER_TABS = [
  { id: "nearby", label: "Nearby", match: [] as string[] },
  { id: "trans", label: "Trans", match: ["T-Girl", "Trans woman"] },
  { id: "sissies", label: "Sissies", match: ["Sissy"] },
  { id: "crossdressers", label: "CDs", match: ["Crossdresser"] },
  { id: "femboys", label: "Femboys", match: ["Femboy"] },
  { id: "men", label: "Men", match: ["Man", "Admirer"] },
  { id: "women", label: "Women", match: ["Woman"] },
  { id: "couples", label: "Couples", match: ["Couple"] },
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
