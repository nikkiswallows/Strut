import { parseJson } from "@/lib/utils";
import type { Profile } from "@/lib/types";

export type ProfileRow = {
  id: number;
  user_id: string;
  handle: string;
  display_name: string;
  age: number | null;
  identity: string | null;
  pronouns: string | null;
  bio: string;
  location: string | null;
  looking_for: string | null;
  photos: unknown;
  interests: unknown;
  height_cm: number | null;
  is_seed: boolean;
  last_active: string;
  onboarded: boolean;
  created_at: string;
  liked_by_me?: boolean | number | string | null;
  likes_me?: boolean | number | string | null;
  following?: boolean | number | string | null;
  like_count?: number | string | null;
};

function flag(value: unknown): boolean {
  return value === true || value === 1 || value === "t" || value === "true";
}

export function mapProfile(row: ProfileRow): Profile {
  return {
    id: Number(row.id),
    userId: row.user_id,
    handle: row.handle,
    displayName: row.display_name,
    age: row.age == null ? null : Number(row.age),
    identity: row.identity,
    pronouns: row.pronouns,
    bio: row.bio ?? "",
    location: row.location,
    lookingFor: row.looking_for,
    photos: parseJson<string[]>(row.photos, []),
    interests: parseJson<string[]>(row.interests, []),
    heightCm: row.height_cm == null ? null : Number(row.height_cm),
    isSeed: flag(row.is_seed),
    lastActive: String(row.last_active),
    onboarded: flag(row.onboarded),
    createdAt: String(row.created_at),
    likedByMe: row.liked_by_me == null ? undefined : flag(row.liked_by_me),
    likesMe: row.likes_me == null ? undefined : flag(row.likes_me),
    matched:
      row.liked_by_me == null || row.likes_me == null
        ? undefined
        : flag(row.liked_by_me) && flag(row.likes_me),
    following: row.following == null ? undefined : flag(row.following),
    likeCount: row.like_count == null ? undefined : Number(row.like_count),
  };
}
