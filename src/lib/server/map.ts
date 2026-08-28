import { parseJson } from "@/lib/utils";
import { asPhotoList, type Profile } from "@/lib/types";

export const PROFILE_COLS = `id, user_id, handle, display_name, age, identity, pronouns, bio,
  location, ethnicity, looking_for, looking_for_list, photos, interests, height_cm, is_seed,
  last_active, onboarded, created_at, identities, pronoun_list, hide_age, discreet, lat, lng, role,
  birth_date, age_attested_at, photo_blurs`;

export const PROFILE_COLS_P = `p.id, p.user_id, p.handle, p.display_name, p.age, p.identity, p.pronouns, p.bio,
  p.location, p.ethnicity, p.looking_for, p.looking_for_list, p.photos, p.interests, p.height_cm, p.is_seed,
  p.last_active, p.onboarded, p.created_at, p.identities, p.pronoun_list, p.hide_age, p.discreet, p.lat, p.lng, p.role,
  p.birth_date, p.age_attested_at, p.photo_blurs`;

/**
 * Public-safe projection: the landing page's featured strip is unauthenticated,
 * so it must never carry coordinates or the age-assurance bookkeeping.
 */
export const PROFILE_COLS_PUBLIC = `id, user_id, handle, display_name, age, identity, pronouns, bio,
  location, ethnicity, looking_for, looking_for_list, photos, interests, height_cm, is_seed,
  last_active, onboarded, created_at, identities, pronoun_list, hide_age, discreet, role, photo_blurs`;

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
  ethnicity: string | null;
  looking_for: string | null;
  looking_for_list?: unknown;
  photos: unknown;
  interests: unknown;
  height_cm: number | null;
  is_seed: boolean;
  last_active: string;
  onboarded: boolean;
  created_at: string;
  identities?: unknown;
  pronoun_list?: unknown;
  hide_age?: boolean | number | string | null;
  discreet?: boolean | number | string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  role?: string | null;
  birth_date?: string | null;
  age_attested_at?: string | null;
  photo_blurs?: unknown;
  liked_by_me?: boolean | number | string | null;
  likes_me?: boolean | number | string | null;
  following?: boolean | number | string | null;
  like_count?: number | string | null;
};

function flag(value: unknown): boolean {
  return value === true || value === 1 || value === "t" || value === "true";
}

function asList(value: unknown, fallback: string | null): string[] {
  const parsed = parseJson<unknown>(value, []);
  if (Array.isArray(parsed) && parsed.length) {
    return parsed.map(String).filter(Boolean);
  }
  if (typeof parsed === "string" && parsed.trim()) return [parsed.trim()];
  if (fallback?.trim()) return [fallback.trim()];
  return [];
}

export function mapProfile(row: ProfileRow): Profile {
  return {
    id: Number(row.id),
    userId: row.user_id,
    handle: row.handle,
    displayName: row.display_name,
    age: row.age == null ? null : Number(row.age),
    hideAge: flag(row.hide_age),
    discreet: flag(row.discreet),
    identities: asList(row.identities, row.identity),
    pronouns: asList(row.pronoun_list, row.pronouns),
    role: row.role?.trim() || null,
    bio: row.bio ?? "",
    location: row.location,
    ethnicity: row.ethnicity?.trim() || null,
    lookingFor: asList(row.looking_for_list, row.looking_for),
    photos: asPhotoList(parseJson<unknown>(row.photos, [])),
    interests: asPhotoList(parseJson<unknown>(row.interests, [])),
    heightCm: row.height_cm == null ? null : Number(row.height_cm),
    lat: row.lat == null || row.lat === "" ? null : Number(row.lat),
    lng: row.lng == null || row.lng === "" ? null : Number(row.lng),
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
    birthDate: row.birth_date ? String(row.birth_date).slice(0, 10) : null,
    photoBlurs: asPhotoList(parseJson<unknown>(row.photo_blurs, [])),
  };
}
