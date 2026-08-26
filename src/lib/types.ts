export const IDENTITIES = [
  "Trans woman",
  "Tgirl",
  "Sissy",
  "Crossdresser",
  "Femboy",
  "Non-binary femme",
  "Genderfluid",
  "Questioning",
] as const;

export const LOOKING_FOR = [
  "Dating",
  "Relationship",
  "Friends",
  "Chat",
  "Nightlife",
] as const;

export const PRONOUNS = ["she/her", "they/them", "she/they", "he/him", "any"] as const;

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
] as const;

export type Identity = (typeof IDENTITIES)[number];
export type LookingFor = (typeof LOOKING_FOR)[number];

export type Profile = {
  id: number;
  userId: string;
  handle: string;
  displayName: string;
  age: number | null;
  identity: string | null;
  pronouns: string | null;
  bio: string;
  location: string | null;
  lookingFor: string | null;
  photos: string[];
  interests: string[];
  heightCm: number | null;
  isSeed: boolean;
  lastActive: string;
  onboarded: boolean;
  createdAt: string;
  likedByMe?: boolean;
  likesMe?: boolean;
  matched?: boolean;
  following?: boolean;
  likeCount?: number;
};

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
